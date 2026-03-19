import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { TRPCError } from "@trpc/server";
import { createAuditLog } from "../db";

export const rfqsRouter = router({

  list: protectedProcedure
    .input(z.object({ status: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return [];

      const { rfqs, users } = await import("../../drizzle/schema");
      const { eq, and, desc } = await import("drizzle-orm");

      const conditions: any[] = [eq(rfqs.organizationId, ctx.user.organizationId)];
      if (input?.status) conditions.push(eq(rfqs.status, input.status as any));

      const rows = await dbInstance.select().from(rfqs)
        .where(and(...conditions))
        .orderBy(desc(rfqs.createdAt))
        .limit(200);

      return Promise.all(rows.map(async (rfq) => {
        const creator = await db.getUserById(rfq.createdBy);
        const { rfqVendors: rfqV, rfqResponses: rfqR } = await import("../../drizzle/schema");
        const vendorCount = await dbInstance.select().from(rfqV).where(eq(rfqV.rfqId, rfq.id));
        const responseCount = await dbInstance.select().from(rfqR).where(eq(rfqR.rfqId, rfq.id));
        return {
          ...rfq,
          creatorName: creator?.name ?? null,
          vendorCount: vendorCount.length,
          responseCount: responseCount.length,
        };
      }));
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { rfqs, rfqItems, rfqVendors, rfqResponses, rfqResponseItems } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");

      const [rfq] = await dbInstance.select().from(rfqs)
        .where(and(eq(rfqs.id, input.id), eq(rfqs.organizationId, ctx.user.organizationId)))
        .limit(1);

      if (!rfq) throw new TRPCError({ code: "NOT_FOUND", message: "RFQ not found" });

      const items = await dbInstance.select().from(rfqItems).where(eq(rfqItems.rfqId, input.id));
      const vendorInvites = await dbInstance.select().from(rfqVendors).where(eq(rfqVendors.rfqId, input.id));
      const responses = await dbInstance.select().from(rfqResponses).where(eq(rfqResponses.rfqId, input.id));

      // Enrich responses with vendor names and line items
      const enrichedResponses = await Promise.all(responses.map(async (r) => {
        const vendor = await db.getVendorById(r.vendorId, ctx.user.organizationId);
        const lineItems = await dbInstance.select().from(rfqResponseItems).where(eq(rfqResponseItems.responseId, r.id));
        return { ...r, vendor: vendor ? { id: vendor.id, legalName: vendor.legalName } : null, lineItems };
      }));

      // Enrich vendors
      const enrichedVendors = await Promise.all(vendorInvites.map(async (v) => {
        const vendor = await db.getVendorById(v.vendorId, ctx.user.organizationId);
        return { ...v, vendor: vendor ? { id: vendor.id, legalName: vendor.legalName } : null };
      }));

      return { ...rfq, items, vendors: enrichedVendors, responses: enrichedResponses };
    }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(255),
      description: z.string().optional(),
      requestId: z.number().optional(),
      deadline: z.string(),
      evaluationCriteria: z.array(z.object({ name: z.string(), weight: z.number() })).optional(),
      items: z.array(z.object({
        itemName: z.string().min(1),
        description: z.string().optional(),
        quantity: z.number().positive(),
        unit: z.string().optional(),
        estimatedUnitPrice: z.number().optional(),
      })).min(1),
      vendorIds: z.array(z.number()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "procurement_manager") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only procurement managers can create RFQs" });
      }

      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { rfqs, rfqItems, rfqVendors } = await import("../../drizzle/schema");

      const { getOrgSettings } = await import("../utils/orgSettings");
      const orgCfgRFQ = await getOrgSettings(ctx.user.organizationId);
      const rfqPrefix = orgCfgRFQ.numberingSequences.rfqPrefix || "AO";
      const rfqNumber = `${rfqPrefix}-${Date.now().toString().slice(-8)}`;
      const result = await dbInstance.insert(rfqs).values({
        organizationId: ctx.user.organizationId,
        rfqNumber,
        title: input.title,
        description: input.description,
        requestId: input.requestId,
        deadline: new Date(input.deadline),
        status: "draft",
        createdBy: ctx.user.id,
        evaluationCriteria: input.evaluationCriteria,
      });

      const rfqId = result[0].insertId;

      // Insert items
      for (const item of input.items) {
        await dbInstance.insert(rfqItems).values({
          rfqId,
          itemName: item.itemName,
          description: item.description,
          quantity: item.quantity.toString(),
          unit: item.unit,
          estimatedUnitPrice: item.estimatedUnitPrice?.toString(),
        });
      }

      // Invite vendors
      if (input.vendorIds?.length) {
        for (const vendorId of input.vendorIds) {
          await dbInstance.insert(rfqVendors).values({ rfqId, vendorId, status: "invited" });
        }
      }

      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "rfq",
        entityId: rfqId,
        action: "created",
        actorId: ctx.user.id,
        newValue: { rfqNumber, title: input.title },
      });

      return { id: rfqId, rfqNumber };
    }),

  send: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "procurement_manager") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { rfqs } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");

      const [rfq] = await dbInstance.select().from(rfqs)
        .where(and(eq(rfqs.id, input.id), eq(rfqs.organizationId, ctx.user.organizationId)))
        .limit(1);

      if (!rfq) throw new TRPCError({ code: "NOT_FOUND" });
      if (rfq.status !== "draft") throw new TRPCError({ code: "BAD_REQUEST", message: "Only draft RFQs can be sent" });

      await dbInstance.update(rfqs).set({ status: "sent" }).where(eq(rfqs.id, input.id));

      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "rfq",
        entityId: input.id,
        action: "sent",
        actorId: ctx.user.id,
        newValue: { status: "sent" },
      });

      return { success: true };
    }),

  addVendor: protectedProcedure
    .input(z.object({ rfqId: z.number(), vendorId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { rfqVendors } = await import("../../drizzle/schema");
      await dbInstance.insert(rfqVendors).values({
        rfqId: input.rfqId,
        vendorId: input.vendorId,
        status: "invited",
      });

      return { success: true };
    }),

  submitResponse: protectedProcedure
    .input(z.object({
      rfqId: z.number(),
      vendorId: z.number(), // the vendor submitting the response
      totalAmount: z.number().positive(),
      deliveryDays: z.number().optional(),
      validUntil: z.string().optional(),
      notes: z.string().optional(),
      lineItems: z.array(z.object({
        rfqItemId: z.number(),
        unitPrice: z.number().positive(),
        totalPrice: z.number().positive(),
        notes: z.string().optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Verify the vendor belongs to this org
      const vendor = await db.getVendorById(input.vendorId, ctx.user.organizationId);
      if (!vendor) throw new TRPCError({ code: "NOT_FOUND", message: "Vendor not found" });

      const { rfqResponses, rfqResponseItems, rfqVendors } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");

      // Mark vendor as responded
      await dbInstance.update(rfqVendors)
        .set({ status: "responded", respondedAt: new Date() })
        .where(and(eq(rfqVendors.rfqId, input.rfqId), eq(rfqVendors.vendorId, input.vendorId)));

      const result = await dbInstance.insert(rfqResponses).values({
        rfqId: input.rfqId,
        vendorId: input.vendorId,
        totalAmount: input.totalAmount.toString(),
        currency: "XOF",
        deliveryDays: input.deliveryDays,
        validUntil: input.validUntil ? new Date(input.validUntil) : undefined,
        notes: input.notes,
        isAwarded: false,
      });

      const responseId = result[0].insertId;

      for (const item of input.lineItems) {
        await dbInstance.insert(rfqResponseItems).values({
          responseId,
          rfqItemId: item.rfqItemId,
          unitPrice: item.unitPrice.toString(),
          totalPrice: item.totalPrice.toString(),
          notes: item.notes,
        });
      }

      // Notify procurement manager that a response was received
      const { createNotification } = await import("../utils/notifications");
      const managerUsers = await dbInstance.select()
        .from((await import("../../drizzle/schema")).users)
        .where(and(
          eq((await import("../../drizzle/schema")).users.organizationId, ctx.user.organizationId),
          eq((await import("../../drizzle/schema")).users.role, "procurement_manager")
        ));
      for (const mgr of managerUsers) {
        await createNotification({
          organizationId: ctx.user.organizationId,
          userId: mgr.id,
          type: "rfq_response",
          title: "Nouvelle réponse à l'appel d'offres",
          message: `${vendor.legalName} a soumis une offre de ${new Intl.NumberFormat("fr-FR").format(input.totalAmount)} XOF.`,
          entityType: "rfq",
          entityId: input.rfqId,
        });
      }

      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "rfqResponse",
        entityId: responseId,
        action: "created",
        actorId: ctx.user.id,
        newValue: { vendorId: input.vendorId, totalAmount: input.totalAmount },
      });

      return { id: responseId };
    }),

  awardVendor: protectedProcedure
    .input(z.object({ rfqId: z.number(), responseId: z.number(), vendorId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "procurement_manager") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { rfqs, rfqResponses } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      await dbInstance.update(rfqs).set({
        status: "awarded",
        awardedVendorId: input.vendorId,
      }).where(eq(rfqs.id, input.rfqId));

      await dbInstance.update(rfqResponses)
        .set({ isAwarded: true })
        .where(eq(rfqResponses.id, input.responseId));

      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "rfq",
        entityId: input.rfqId,
        action: "awarded",
        actorId: ctx.user.id,
        newValue: { awardedVendorId: input.vendorId, responseId: input.responseId },
      });

      return { success: true };
    }),

  scoreResponse: protectedProcedure
    .input(z.object({
      responseId: z.number(),
      scores: z.record(z.number()),
      totalScore: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { rfqResponses } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      await dbInstance.update(rfqResponses)
        .set({ scores: input.scores, totalScore: input.totalScore.toString() })
        .where(eq(rfqResponses.id, input.responseId));

      return { success: true };
    }),
});
