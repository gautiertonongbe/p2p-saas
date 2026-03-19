import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { TRPCError } from "@trpc/server";
import { createAuditLog } from "../db";
import { generatePurchaseOrderPDF } from "../utils/pdfGenerator";

const createPOSchema = z.object({
  requestId: z.number().optional(),
  vendorId: z.number(),
  expectedDeliveryDate: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    itemName: z.string(),
    description: z.string().optional(),
    quantity: z.number().positive(),
    unitPrice: z.number().positive(),
    unit: z.string().optional(),
  })),
});

export const purchaseOrdersRouter = router({
  list: protectedProcedure
    .input(z.object({
      status: z.string().optional(),
      vendorId: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const orders = await db.getPurchaseOrders(ctx.user.organizationId);

      let filtered = orders;
      if (input?.status) {
        filtered = filtered.filter(o => o.status === input.status);
      }
      if (input?.vendorId) {
        filtered = filtered.filter(o => o.vendorId === input.vendorId);
      }

      // Batch load vendors to avoid N+1 queries
      const vendorIds = [...new Set(filtered.map(o => o.vendorId))];
      const vendorMap = new Map<number, { id: number; legalName: string; tradeName: string | null }>();
      await Promise.all(vendorIds.map(async (vid) => {
        const vendor = await db.getVendorById(vid, ctx.user.organizationId);
        if (vendor) vendorMap.set(vendor.id, { id: vendor.id, legalName: vendor.legalName, tradeName: vendor.tradeName ?? null });
      }));

      return filtered.map(order => ({
        ...order,
        vendor: vendorMap.get(order.vendorId) ?? null,
      }));
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const order = await db.getPurchaseOrderById(input.id, ctx.user.organizationId);
      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Purchase order not found" });
      }

      // Get vendor details
      const vendor = await db.getVendorById(order.vendorId, ctx.user.organizationId);
      
      // Get items
      const dbInstance = await db.getDb();
      let items: any[] = [];
      if (dbInstance) {
        const { purchaseOrderItems } = await import("../../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        items = await dbInstance.select().from(purchaseOrderItems)
          .where(eq(purchaseOrderItems.poId, input.id));
      }

      return {
        ...order,
        vendor,
        items,
      };
    }),

  create: protectedProcedure
    .input(createPOSchema)
    .mutation(async ({ ctx, input }) => {
      const { items, ...orderData } = input;
      
      // Generate PO number
      const timestamp = Date.now();
      const { getOrgSettings } = await import("../utils/orgSettings");
      const orgCfgPO = await getOrgSettings(ctx.user.organizationId);
      const poPrefix = orgCfgPO.numberingSequences.poPrefix || "BC";
      const poNumber = `${poPrefix}-${timestamp.toString().slice(-8)}`;
      
      // Calculate total
      const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
      const taxAmount = totalAmount * 0.18; // 18% VAT for West Africa
      
      const poId = await db.createPurchaseOrder({
        ...orderData,
        organizationId: ctx.user.organizationId,
        poNumber,
        totalAmount: totalAmount.toString(),
        taxAmount: taxAmount.toString(),
        status: "draft",
        currency: "XOF",
        expectedDeliveryDate: orderData.expectedDeliveryDate ? new Date(orderData.expectedDeliveryDate) : null,
      });

      // Create PO items
      const dbInstance = await db.getDb();
      if (dbInstance) {
        const { purchaseOrderItems } = await import("../../drizzle/schema");
        for (const item of items) {
          const totalPrice = item.quantity * item.unitPrice;
          await dbInstance.insert(purchaseOrderItems).values({
            poId,
            itemName: item.itemName,
            description: item.description,
            quantity: item.quantity.toString(),
            unitPrice: item.unitPrice.toString(),
            totalPrice: totalPrice.toString(),
            unit: item.unit,
            receivedQuantity: "0",
          });
        }
      }

      // Audit log
      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "purchaseOrder",
        entityId: poId,
        action: "created",
        actorId: ctx.user.id,
        newValue: { poNumber, ...orderData, totalAmount, taxAmount },
      });

      return { id: poId, poNumber };
    }),

  issue: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const order = await db.getPurchaseOrderById(input.id, ctx.user.organizationId);
      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Purchase order not found" });
      }

      if (order.status !== "draft") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only draft POs can be issued" });
      }

      const dbInstance = await db.getDb();
      if (dbInstance) {
        const { purchaseOrders } = await import("../../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        
        await dbInstance.update(purchaseOrders)
          .set({ status: "issued", issuedAt: new Date() })
          .where(and(
            eq(purchaseOrders.id, input.id),
            eq(purchaseOrders.organizationId, ctx.user.organizationId)
          ));
      }

      // Audit log
      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "purchaseOrder",
        entityId: input.id,
        action: "issued",
        actorId: ctx.user.id,
        oldValue: { status: order.status },
        newValue: { status: "issued", issuedAt: new Date() },
      });

      return { success: true };
    }),

  cancel: protectedProcedure
    .input(z.object({ id: z.number(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const order = await db.getPurchaseOrderById(input.id, ctx.user.organizationId);
      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Purchase order not found" });
      }

      if (["received", "closed", "cancelled"].includes(order.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot cancel this PO" });
      }

      const dbInstance = await db.getDb();
      if (dbInstance) {
        const { purchaseOrders } = await import("../../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        
        await dbInstance.update(purchaseOrders)
          .set({ status: "cancelled" })
          .where(and(
            eq(purchaseOrders.id, input.id),
            eq(purchaseOrders.organizationId, ctx.user.organizationId)
          ));
      }

      // Audit log
      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "purchaseOrder",
        entityId: input.id,
        action: "cancelled",
        actorId: ctx.user.id,
        oldValue: { status: order.status },
        newValue: { status: "cancelled", reason: input.reason },
      });

      return { success: true };
    }),

  recordReceipt: protectedProcedure
    .input(z.object({
      poId: z.number(),
      items: z.array(z.object({
        poItemId: z.number(),
        quantityReceived: z.number().positive(),
        condition: z.enum(["good", "damaged", "partial"]).default("good"),
        notes: z.string().optional(),
      })),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const order = await db.getPurchaseOrderById(input.poId, ctx.user.organizationId);
      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Purchase order not found" });
      }

      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Generate receipt number
      const timestamp = Date.now();
      const receiptNumber = `RCP-${timestamp.toString().slice(-8)}`;

      // Create receipt
      const { receipts, receiptItems, purchaseOrderItems, purchaseOrders } = await import("../../drizzle/schema");
      const result = await dbInstance.insert(receipts).values({
        organizationId: ctx.user.organizationId,
        poId: input.poId,
        receiptNumber,
        receivedBy: ctx.user.id,
        receivedAt: new Date(),
        notes: input.notes,
      });

      const receiptId = result[0].insertId;

      // Create receipt items and update PO item quantities
      const { eq } = await import("drizzle-orm");
      for (const item of input.items) {
        await dbInstance.insert(receiptItems).values({
          receiptId,
          poItemId: item.poItemId,
          quantityReceived: item.quantityReceived.toString(),
          condition: item.condition,
          notes: item.notes,
        });

        // Update received quantity on PO item
        const poItem = await dbInstance.select().from(purchaseOrderItems)
          .where(eq(purchaseOrderItems.id, item.poItemId))
          .limit(1);
        
        if (poItem.length > 0) {
          const currentReceived = parseFloat(poItem[0].receivedQuantity || "0");
          const newReceived = currentReceived + item.quantityReceived;
          
          await dbInstance.update(purchaseOrderItems)
            .set({ receivedQuantity: newReceived.toString() })
            .where(eq(purchaseOrderItems.id, item.poItemId));
        }
      }

      // Check if PO is fully received
      const allItems = await dbInstance.select().from(purchaseOrderItems)
        .where(eq(purchaseOrderItems.poId, input.poId));
      
      const fullyReceived = allItems.every(item => {
        const ordered = parseFloat(item.quantity);
        const received = parseFloat(item.receivedQuantity || "0");
        return received >= ordered;
      });

      const partiallyReceived = allItems.some(item => {
        const received = parseFloat(item.receivedQuantity || "0");
        return received > 0;
      });

      // Update PO status
      const newStatus = fullyReceived ? "received" : (partiallyReceived ? "partially_received" : order.status);
      if (newStatus !== order.status) {
        await dbInstance.update(purchaseOrders)
          .set({ status: newStatus })
          .where(eq(purchaseOrders.id, input.poId));
      }

      // Auto-update vendor performance score when order fully received
      if (newStatus === "received") {
        try {
          // Score: 100 base, deduct for lateness if expectedDeliveryDate exists
          const expectedDate = (order as any).expectedDeliveryDate;
          let score = 100;
          if (expectedDate) {
            const expected = new Date(expectedDate);
            const actual = new Date();
            const daysLate = Math.floor((actual.getTime() - expected.getTime()) / (1000 * 60 * 60 * 24));
            if (daysLate > 0) score = Math.max(0, score - daysLate * 5); // -5 pts per late day
            if (daysLate < 0) score = Math.min(100, score + 5); // +5 pts for early delivery
          }

          // Rolling average: blend with existing score (75% old + 25% new)
          const { vendors } = await import("../../drizzle/schema");
          const [vendor] = await dbInstance.select().from(vendors).where(eq(vendors.id, order.vendorId)).limit(1);
          if (vendor) {
            const existingScore = vendor.performanceScore ? parseFloat(vendor.performanceScore) : score;
            const newScore = Math.round(existingScore * 0.75 + score * 0.25);
            await dbInstance.update(vendors)
              .set({ performanceScore: newScore.toString() })
              .where(eq(vendors.id, order.vendorId));
          }
        } catch (scoreErr) {
          console.warn("[PO] Failed to update vendor performance score:", (scoreErr as Error).message);
        }
      }

      // Audit log
      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "receipt",
        entityId: receiptId,
        action: "created",
        actorId: ctx.user.id,
        newValue: { receiptNumber, poId: input.poId, items: input.items },
      });

      return { success: true, receiptId, receiptNumber };
    }),

  approve: protectedProcedure
    .input(z.object({
      poId: z.number(),
      comment: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "procurement_manager") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized to approve purchase orders" });
      }

      const order = await db.getPurchaseOrderById(input.poId, ctx.user.organizationId);
      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Purchase order not found" });
      }

      const dbInstance = await db.getDb();
      if (dbInstance) {
        const { purchaseOrders } = await import("../../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        
        await dbInstance.update(purchaseOrders)
          .set({ 
            status: "approved",
            approvedBy: ctx.user.id,
            approvedAt: new Date(),
          })
          .where(and(
            eq(purchaseOrders.id, input.poId),
            eq(purchaseOrders.organizationId, ctx.user.organizationId)
          ));
      }

      // Audit log
      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "purchaseOrder",
        entityId: input.poId,
        action: "approved",
        actorId: ctx.user.id,
        newValue: { status: "approved", comment: input.comment },
      });

      return { success: true };
    }),

  reject: protectedProcedure
    .input(z.object({
      poId: z.number(),
      reason: z.string().min(1, "Rejection reason is required"),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "procurement_manager") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized to reject purchase orders" });
      }

      const order = await db.getPurchaseOrderById(input.poId, ctx.user.organizationId);
      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Purchase order not found" });
      }

      const dbInstance = await db.getDb();
      if (dbInstance) {
        const { purchaseOrders } = await import("../../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        
        await dbInstance.update(purchaseOrders)
          .set({ status: "rejected" })
          .where(and(
            eq(purchaseOrders.id, input.poId),
            eq(purchaseOrders.organizationId, ctx.user.organizationId)
          ));
      }

      // Audit log
      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "purchaseOrder",
        entityId: input.poId,
        action: "rejected",
        actorId: ctx.user.id,
        newValue: { status: "rejected", reason: input.reason },
      });

      return { success: true };
    }),

  adminBypassApproval: protectedProcedure
    .input(z.object({
      poId: z.number(),
      comment: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can bypass approvals" });
      }

      const order = await db.getPurchaseOrderById(input.poId, ctx.user.organizationId);
      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Purchase order not found" });
      }

      const dbInstance = await db.getDb();
      if (dbInstance) {
        const { purchaseOrders } = await import("../../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        
        await dbInstance.update(purchaseOrders)
          .set({ 
            status: "approved",
            approvedBy: ctx.user.id,
            approvedAt: new Date(),
          })
          .where(and(
            eq(purchaseOrders.id, input.poId),
            eq(purchaseOrders.organizationId, ctx.user.organizationId)
          ));
      }

      // Audit log
      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "purchaseOrder",
        entityId: input.poId,
        action: "admin_bypass_approval",
        actorId: ctx.user.id,
        newValue: { status: "approved", bypassedBy: ctx.user.id, comment: input.comment },
      });

      return { success: true };
    }),

  exportPDF: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const order = await db.getPurchaseOrderById(input.id, ctx.user.organizationId);
      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Purchase order not found" });
      }

      // Get vendor details
      const vendor = await db.getVendorById(order.vendorId, ctx.user.organizationId);
      if (!vendor) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Vendor not found" });
      }

      // Get organization details
      const organization = await db.getOrganizationById(ctx.user.organizationId);
      if (!organization) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
      }

      // Get items
      const dbInstance = await db.getDb();
      let items: any[] = [];
      if (dbInstance) {
        const { purchaseOrderItems } = await import("../../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        items = await dbInstance.select().from(purchaseOrderItems)
          .where(eq(purchaseOrderItems.poId, input.id));
      }

      // Generate PDF
      const pdfBuffer = await generatePurchaseOrderPDF(
        {
          poNumber: order.poNumber,
          issuedAt: order.issuedAt || undefined,
          createdAt: order.createdAt,
          expectedDeliveryDate: order.expectedDeliveryDate || undefined,
          totalAmount: order.totalAmount,
          taxAmount: order.taxAmount || '0',
          notes: order.notes || undefined,
          status: order.status,
        },
        items,
        {
          name: organization.legalName,
          address: undefined, // Organization doesn't have address in schema
          phone: undefined,
          email: undefined,
          taxId: undefined,
        },
        {
          legalName: vendor.legalName,
          address: vendor.country ? `${vendor.country}` : undefined,
          phone: vendor.contactPhone || undefined,
          email: vendor.contactEmail || undefined,
        }
      );

      // Return as base64 for client download
      return {
        pdf: pdfBuffer.toString('base64'),
        filename: `${order.poNumber}.pdf`,
      };
    }),
});
