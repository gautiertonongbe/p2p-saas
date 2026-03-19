import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { TRPCError } from "@trpc/server";
import { createAuditLog } from "../db";

const createVendorSchema = z.object({
  legalName: z.string().min(1).max(255),
  tradeName: z.string().max(255).optional(),
  country: z.string().max(100).optional(),
  taxId: z.string().max(100).optional(),
  isFormal: z.boolean().default(true),
  contactName: z.string().max(255).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(50).optional(),
  bankAccounts: z.array(z.object({
    bankName: z.string(),
    accountNumber: z.string(),
    iban: z.string().optional(),
  })).optional(),
  mobileMoneyAccounts: z.array(z.object({
    provider: z.string(),
    number: z.string(),
  })).optional(),
});

export const vendorsRouter = router({
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["active", "inactive", "pending"]).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const vendors = await db.getVendors(ctx.user.organizationId);
      
      if (input?.status) {
        return vendors.filter(v => v.status === input.status);
      }
      
      return vendors;
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const vendor = await db.getVendorById(input.id, ctx.user.organizationId);
      if (!vendor) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Vendor not found" });
      }

      // Get contracts
      const dbInstance = await db.getDb();
      let contracts: any[] = [];
      if (dbInstance) {
        const { vendorContracts } = await import("../../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        contracts = await dbInstance.select().from(vendorContracts)
          .where(eq(vendorContracts.vendorId, input.id));
      }

      return {
        ...vendor,
        contracts,
      };
    }),

  create: protectedProcedure
    .input(createVendorSchema)
    .mutation(async ({ ctx, input }) => {
      const vendorId = await db.createVendor({
        ...input,
        organizationId: ctx.user.organizationId,
        status: "pending",
      });

      // Audit log
      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "vendor",
        entityId: vendorId,
        action: "created",
        actorId: ctx.user.id,
        newValue: input,
      });

      return { id: vendorId };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      data: createVendorSchema.partial(),
    }))
    .mutation(async ({ ctx, input }) => {
      const vendor = await db.getVendorById(input.id, ctx.user.organizationId);
      if (!vendor) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Vendor not found" });
      }

      const dbInstance = await db.getDb();
      if (dbInstance) {
        const { vendors } = await import("../../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        
        await dbInstance.update(vendors)
          .set(input.data)
          .where(and(
            eq(vendors.id, input.id),
            eq(vendors.organizationId, ctx.user.organizationId)
          ));
      }

      // Audit log
      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "vendor",
        entityId: input.id,
        action: "updated",
        actorId: ctx.user.id,
        oldValue: vendor,
        newValue: input.data,
      });

      return { success: true };
    }),

  approve: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "procurement_manager") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized to approve vendors" });
      }

      const vendor = await db.getVendorById(input.id, ctx.user.organizationId);
      if (!vendor) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Vendor not found" });
      }

      const dbInstance = await db.getDb();
      if (dbInstance) {
        const { vendors } = await import("../../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        
        await dbInstance.update(vendors)
          .set({ status: "active" })
          .where(and(
            eq(vendors.id, input.id),
            eq(vendors.organizationId, ctx.user.organizationId)
          ));
      }

      // Audit log
      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "vendor",
        entityId: input.id,
        action: "approved",
        actorId: ctx.user.id,
        oldValue: { status: vendor.status },
        newValue: { status: "active" },
      });

      return { success: true };
    }),

  deactivate: protectedProcedure
    .input(z.object({ id: z.number(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "procurement_manager") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized to deactivate vendors" });
      }

      const vendor = await db.getVendorById(input.id, ctx.user.organizationId);
      if (!vendor) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Vendor not found" });
      }

      const dbInstance = await db.getDb();
      if (dbInstance) {
        const { vendors } = await import("../../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        
        await dbInstance.update(vendors)
          .set({ status: "inactive" })
          .where(and(
            eq(vendors.id, input.id),
            eq(vendors.organizationId, ctx.user.organizationId)
          ));
      }

      // Audit log
      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "vendor",
        entityId: input.id,
        action: "deactivated",
        actorId: ctx.user.id,
        oldValue: { status: vendor.status },
        newValue: { status: "inactive", reason: input.reason },
      });

      return { success: true };
    }),

  addContract: protectedProcedure
    .input(z.object({
      vendorId: z.number(),
      contractNumber: z.string(),
      title: z.string(),
      startDate: z.string(),
      endDate: z.string().optional(),
      totalValue: z.number().optional(),
      documentUrl: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const vendor = await db.getVendorById(input.vendorId, ctx.user.organizationId);
      if (!vendor) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Vendor not found" });
      }

      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { vendorContracts } = await import("../../drizzle/schema");
      const result = await dbInstance.insert(vendorContracts).values({
        vendorId: input.vendorId,
        contractNumber: input.contractNumber,
        title: input.title,
        startDate: new Date(input.startDate),
        endDate: input.endDate ? new Date(input.endDate) : null,
        totalValue: input.totalValue?.toString(),
        currency: "XOF",
        status: "active",
        documentUrl: input.documentUrl,
      });

      const contractId = result[0].insertId;

      // Audit log
      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "vendorContract",
        entityId: contractId,
        action: "created",
        actorId: ctx.user.id,
        newValue: input,
      });

      return { id: contractId };
    }),

  getPerformanceMetrics: protectedProcedure
    .input(z.object({ vendorId: z.number() }))
    .query(async ({ ctx, input }) => {
      const vendor = await db.getVendorById(input.vendorId, ctx.user.organizationId);
      if (!vendor) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Vendor not found" });
      }

      const dbInstance = await db.getDb();
      if (!dbInstance) return { totalOrders: 0, totalSpend: 0, onTimeDeliveryRate: 0 };

      const { purchaseOrders, invoices } = await import("../../drizzle/schema");
      const { eq, and, sql } = await import("drizzle-orm");

      // Get total orders
      const orders = await dbInstance.select().from(purchaseOrders)
        .where(and(
          eq(purchaseOrders.organizationId, ctx.user.organizationId),
          eq(purchaseOrders.vendorId, input.vendorId)
        ));

      // Get total spend
      const totalSpend = orders.reduce((sum, order) => sum + parseFloat(order.totalAmount || "0"), 0);

      // Calculate on-time delivery (simplified - based on received status)
      const receivedOrders = orders.filter(o => o.status === "received");
      const onTimeDeliveryRate = receivedOrders.length > 0 
        ? (receivedOrders.length / orders.length) * 100 
        : 0;

      return {
        totalOrders: orders.length,
        totalSpend,
        onTimeDeliveryRate: Math.round(onTimeDeliveryRate),
        performanceScore: vendor.performanceScore ? parseFloat(vendor.performanceScore) : null,
      };
    }),

  // Contracts expiring within the next N days
  getExpiringContracts: protectedProcedure
    .input(z.object({ daysAhead: z.number().min(1).max(365).default(30) }))
    .query(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return [];

      const { vendorContracts, vendors: vendorsTable } = await import("../../drizzle/schema");
      const { eq, and, lte, gte, isNotNull } = await import("drizzle-orm");

      const now = new Date();
      const cutoff = new Date(now.getTime() + input.daysAhead * 24 * 60 * 60 * 1000);

      // Get all active contracts with an end date within the window
      const contracts = await dbInstance.select().from(vendorContracts)
        .where(and(
          isNotNull(vendorContracts.endDate),
          lte(vendorContracts.endDate, cutoff),
          gte(vendorContracts.endDate, now),
          eq(vendorContracts.status, "active")
        ));

      // Enrich with vendor name (filter to org)
      const enriched = await Promise.all(contracts.map(async (c) => {
        const vendor = await db.getVendorById(c.vendorId, ctx.user.organizationId);
        if (!vendor) return null;
        const daysLeft = Math.ceil((new Date(c.endDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return { ...c, vendorName: vendor.legalName, daysLeft };
      }));

      return enriched.filter(Boolean);
    }),
});
