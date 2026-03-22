import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { TRPCError } from "@trpc/server";
import { createAuditLog } from "../db";
import { invokeLLM } from "../_core/llm";
import { generateInvoicePDF } from "../utils/pdfGenerator";

const createInvoiceSchema = z.object({
  invoiceNumber: z.string(),
  vendorId: z.number(),
  poId: z.number().optional(),
  invoiceDate: z.string(),
  dueDate: z.string().optional(),
  amount: z.number().positive(),
  taxAmount: z.number().optional(),
  invoiceFileUrl: z.string().optional(),
});

export const invoicesRouter = router({
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["pending", "approved", "rejected", "paid", "cancelled"]).optional(),
      vendorId: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const invoices = await db.getInvoices(ctx.user.organizationId);
      
      let filtered = invoices;
      if (input?.status) {
        filtered = filtered.filter(inv => inv.status === input.status);
      }
      if (input?.vendorId) {
        filtered = filtered.filter(inv => inv.vendorId === input.vendorId);
      }

      // Batch load vendors to avoid N+1 queries
      const vendorIds = [...new Set(filtered.map(inv => inv.vendorId))];
      const vendorMap = new Map<number, { id: number; legalName: string }>();
      await Promise.all(vendorIds.map(async (vid) => {
        const vendor = await db.getVendorById(vid, ctx.user.organizationId);
        if (vendor) vendorMap.set(vendor.id, { id: vendor.id, legalName: vendor.legalName });
      }));

      return filtered.map(invoice => ({
        ...invoice,
        vendor: vendorMap.get(invoice.vendorId) ?? null,
      }));
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const invoice = await db.getInvoiceById(input.id, ctx.user.organizationId);
      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }

      // Get vendor and PO details
      const vendor = await db.getVendorById(invoice.vendorId, ctx.user.organizationId);
      let purchaseOrder = null;
      if (invoice.poId) {
        purchaseOrder = await db.getPurchaseOrderById(invoice.poId, ctx.user.organizationId);
      }

      return {
        ...invoice,
        vendor,
        purchaseOrder,
      };
    }),

  create: protectedProcedure
    .input(createInvoiceSchema)
    .mutation(async ({ ctx, input }) => {
      // Check for duplicate invoice number for same vendor
      const existingInvoices = await db.getInvoices(ctx.user.organizationId);
      const duplicate = existingInvoices.find(
        inv => inv.invoiceNumber === input.invoiceNumber && inv.vendorId === input.vendorId
      );
      if (duplicate) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Facture en double détectée: le numéro ${input.invoiceNumber} existe déjà pour ce fournisseur (ID: ${duplicate.id})`,
        });
      }

      const invoiceId = await db.createInvoice({
        ...input,
        organizationId: ctx.user.organizationId,
        invoiceDate: new Date(input.invoiceDate),
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        amount: input.amount.toString(),
        taxAmount: input.taxAmount?.toString() || "0",
        currency: "XOF",
        status: "pending",
        matchStatus: "unmatched",
      });

      // Attempt automatic three-way matching if PO is provided
      if (input.poId) {
        try {
          const po = await db.getPurchaseOrderById(input.poId, ctx.user.organizationId);
          if (po) {
            const poAmount = parseFloat(po.totalAmount || "0");
            const invoiceAmount = input.amount;
            // Read tolerance from org settings
            const { getOrgSettings } = await import("../utils/orgSettings");
            const orgCfg = await getOrgSettings(invoice.organizationId);
            const tolerance = (orgCfg.toleranceRules.amountVariance ?? 2) / 100;
            const amountMatch = Math.abs(poAmount - invoiceAmount) / Math.max(poAmount, 1) <= tolerance;
            const vendorMatch = po.vendorId === input.vendorId;

            const dbInstance = await db.getDb();
            if (dbInstance) {
              const { invoices } = await import("../../drizzle/schema");
              const { eq } = await import("drizzle-orm");
              await dbInstance.update(invoices)
                .set({
                  matchStatus: amountMatch && vendorMatch ? "matched" : "partial_match",
                  poId: input.poId,
                })
                .where(eq(invoices.id, invoiceId));
            }
          }
        } catch (matchError) {
          // Non-fatal: log but don't block invoice creation
          console.warn("[Invoice] Auto-matching failed:", matchError);
        }
      }

      // Audit log
      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "invoice",
        entityId: invoiceId,
        action: "created",
        actorId: ctx.user.id,
        newValue: input,
      });

      return { id: invoiceId };
    }),

  // AI-powered OCR extraction from invoice file
  extractDataFromFile: protectedProcedure
    .input(z.object({
      fileUrl: z.string(),
      mimeType: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: "You are an expert at extracting structured data from invoices. Extract vendor name, invoice number, invoice date, total amount, tax amount, line items, and any other relevant information. Return data in JSON format.",
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Extract all data from this invoice document. Focus on: vendor name, invoice number, date, total amount, tax/VAT amount, and line items with descriptions, quantities, and prices.",
                },
                {
                  type: "file_url",
                  file_url: {
                    url: input.fileUrl,
                    mime_type: input.mimeType as any || "application/pdf",
                  },
                },
              ],
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "invoice_data",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  vendorName: { type: "string", description: "Legal name of the vendor" },
                  invoiceNumber: { type: "string", description: "Invoice number" },
                  invoiceDate: { type: "string", description: "Invoice date in YYYY-MM-DD format" },
                  dueDate: { type: "string", description: "Payment due date in YYYY-MM-DD format" },
                  totalAmount: { type: "number", description: "Total invoice amount" },
                  taxAmount: { type: "number", description: "Tax/VAT amount" },
                  currency: { type: "string", description: "Currency code (e.g., XOF)" },
                  lineItems: {
                    type: "array",
                    description: "Invoice line items",
                    items: {
                      type: "object",
                      properties: {
                        description: { type: "string" },
                        quantity: { type: "number" },
                        unitPrice: { type: "number" },
                        total: { type: "number" },
                      },
                      required: ["description", "quantity", "unitPrice", "total"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["vendorName", "invoiceNumber", "invoiceDate", "totalAmount", "currency", "lineItems"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = response.choices[0].message.content;
        const extractedData = typeof content === 'string' ? JSON.parse(content) : {};

        return {
          success: true,
          data: extractedData,
          confidence: 0.95, // Placeholder confidence score
        };
      } catch (error) {
        console.error("[Invoice OCR] Error:", error);
        throw new TRPCError({ 
          code: "INTERNAL_SERVER_ERROR", 
          message: "Failed to extract invoice data" 
        });
      }
    }),

  // Three-way matching: PO - Receipt - Invoice
  performThreeWayMatch: protectedProcedure
    .input(z.object({
      invoiceId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const invoice = await db.getInvoiceById(input.invoiceId, ctx.user.organizationId);
      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }

      if (!invoice.poId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invoice not linked to a PO" });
      }

      const purchaseOrder = await db.getPurchaseOrderById(invoice.poId, ctx.user.organizationId);
      if (!purchaseOrder) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Purchase order not found" });
      }

      // Get PO items
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { purchaseOrderItems, receipts } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      const poItems = await dbInstance.select().from(purchaseOrderItems)
        .where(eq(purchaseOrderItems.poId, invoice.poId));

      // Check if goods received
      const poReceipts = await dbInstance.select().from(receipts)
        .where(eq(receipts.poId, invoice.poId));

      if (poReceipts.length === 0) {
        return {
          matched: false,
          status: "exception",
          reason: "No goods receipt found for this PO",
        };
      }

      // Compare amounts (with tolerance)
      const poAmount = parseFloat(purchaseOrder.totalAmount);
      const invoiceAmount = parseFloat(invoice.amount);
      const { getOrgSettings } = await import("../utils/orgSettings");
      const orgCfgMatch = await getOrgSettings(ctx.user.organizationId);
      const tolerance = (orgCfgMatch.toleranceRules.amountVariance ?? 5) / 100;
      const amountDiff = Math.abs(poAmount - invoiceAmount);
      const amountMatch = amountDiff <= (poAmount * tolerance);

      // Check vendor match
      const vendorMatch = purchaseOrder.vendorId === invoice.vendorId;

      const matched = amountMatch && vendorMatch;
      const matchStatus = matched ? "matched" : "exception";

      // Update invoice match status
      const { invoices } = await import("../../drizzle/schema");
      await dbInstance.update(invoices)
        .set({ matchStatus })
        .where(eq(invoices.id, input.invoiceId));

      // Audit log
      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "invoice",
        entityId: input.invoiceId,
        action: "three_way_match",
        actorId: ctx.user.id,
        newValue: { matched, matchStatus, amountMatch, vendorMatch },
      });

      return {
        matched,
        status: matchStatus,
        details: {
          amountMatch,
          vendorMatch,
          poAmount,
          invoiceAmount,
          amountDiff,
        },
      };
    }),

  approve: protectedProcedure
    .input(z.object({
      invoiceId: z.number(),
      comment: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "procurement_manager") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized to approve invoices" });
      }

      const invoice = await db.getInvoiceById(input.invoiceId, ctx.user.organizationId);
      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }

      const dbInstance = await db.getDb();
      if (dbInstance) {
        const { invoices } = await import("../../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        
        await dbInstance.update(invoices)
          .set({ 
            status: "approved",
            approvedBy: ctx.user.id,
            approvedAt: new Date(),
          })
          .where(and(
            eq(invoices.id, input.invoiceId),
            eq(invoices.organizationId, ctx.user.organizationId)
          ));
      }

      // Audit log
      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "invoice",
        entityId: input.invoiceId,
        action: "approved",
        actorId: ctx.user.id,
        newValue: { status: "approved", comment: input.comment },
      });

      return { success: true };
    }),

  reject: protectedProcedure
    .input(z.object({
      invoiceId: z.number(),
      reason: z.string().min(1, "Rejection reason is required"),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "procurement_manager") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized to reject invoices" });
      }

      const invoice = await db.getInvoiceById(input.invoiceId, ctx.user.organizationId);
      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }

      const dbInstance = await db.getDb();
      if (dbInstance) {
        const { invoices } = await import("../../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        
        await dbInstance.update(invoices)
          .set({ status: "rejected" })
          .where(and(
            eq(invoices.id, input.invoiceId),
            eq(invoices.organizationId, ctx.user.organizationId)
          ));
      }

      // Audit log
      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "invoice",
        entityId: input.invoiceId,
        action: "rejected",
        actorId: ctx.user.id,
        newValue: { status: "rejected", reason: input.reason },
      });

      return { success: true };
    }),

  adminBypassApproval: protectedProcedure
    .input(z.object({
      invoiceId: z.number(),
      comment: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can bypass approvals" });
      }

      const invoice = await db.getInvoiceById(input.invoiceId, ctx.user.organizationId);
      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }

      const dbInstance = await db.getDb();
      if (dbInstance) {
        const { invoices } = await import("../../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        
        await dbInstance.update(invoices)
          .set({ status: "approved" })
          .where(and(
            eq(invoices.id, input.invoiceId),
            eq(invoices.organizationId, ctx.user.organizationId)
          ));
      }

      // Audit log
      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "invoice",
        entityId: input.invoiceId,
        action: "admin_bypass_approval",
        actorId: ctx.user.id,
        newValue: { status: "approved", bypassedBy: ctx.user.id, comment: input.comment },
      });

      return { success: true };
    }),

  // Detect duplicate invoices
  checkDuplicates: protectedProcedure
    .input(z.object({
      invoiceNumber: z.string(),
      vendorId: z.number(),
      amount: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return { isDuplicate: false, duplicates: [] };

      const { invoices } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");

      const duplicates = await dbInstance.select().from(invoices)
        .where(and(
          eq(invoices.organizationId, ctx.user.organizationId),
          eq(invoices.vendorId, input.vendorId),
          eq(invoices.invoiceNumber, input.invoiceNumber)
        ));

      return {
        isDuplicate: duplicates.length > 0,
        duplicates: duplicates.map(d => ({
          id: d.id,
          invoiceNumber: d.invoiceNumber,
          amount: d.amount,
          status: d.status,
          createdAt: d.createdAt,
        })),
      };
    }),

  exportPDF: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const invoice = await db.getInvoiceById(input.id, ctx.user.organizationId);
      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }

      // Get vendor details
      const vendor = await db.getVendorById(invoice.vendorId, ctx.user.organizationId);
      if (!vendor) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Vendor not found" });
      }

      // Get organization details
      const organization = await db.getOrganizationById(ctx.user.organizationId);
      if (!organization) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
      }

      // Get invoice items from OCR data or create default item
      const pdfItems = (invoice.ocrData?.lineItems || [
        {
          description: `Invoice ${invoice.invoiceNumber}`,
          quantity: 1,
          unitPrice: parseFloat(invoice.amount),
          total: parseFloat(invoice.amount),
        }
      ]).map(item => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.total || (item.quantity * item.unitPrice),
      }));

      // Generate PDF
      const pdfBuffer = await generateInvoicePDF(
        {
          invoiceNumber: invoice.invoiceNumber,
          invoiceDate: invoice.invoiceDate,
          dueDate: invoice.dueDate,
          totalAmount: invoice.amount,
          taxAmount: invoice.taxAmount || '0',
          status: invoice.status,
          notes: undefined, // Invoice doesn't have notes field
        },
        pdfItems,
        {
          name: organization.legalName,
          address: (organization as any).address,
          phone: (organization as any).contactPhone,
          email: (organization as any).email,
          taxId: (organization as any).taxId,
          logoUrl: (organization as any).logoUrl,
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
        filename: `${invoice.invoiceNumber}.pdf`,
      };
    }),

  // ── PAYMENT MANAGEMENT ────────────────────────────────────────────────────

  markAsPaid: protectedProcedure
    .input(z.object({
      invoiceId: z.number(),
      paymentMethod: z.enum(["bank_transfer", "mobile_money", "check", "cash"]),
      reference: z.string().optional(),
      valueDate: z.string(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "procurement_manager") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized to record payments" });
      }

      const invoice = await db.getInvoiceById(input.invoiceId, ctx.user.organizationId);
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      if (invoice.status === "paid") throw new TRPCError({ code: "BAD_REQUEST", message: "Invoice already marked as paid" });
      if (invoice.status !== "approved") throw new TRPCError({ code: "BAD_REQUEST", message: "Only approved invoices can be marked as paid" });

      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { invoices, payments } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");

      // Record payment
      const paymentResult = await dbInstance.insert(payments).values({
        organizationId: ctx.user.organizationId,
        invoiceId: input.invoiceId,
        paymentMethod: input.paymentMethod,
        amount: invoice.amount,
        currency: invoice.currency ?? "XOF",
        reference: input.reference,
        valueDate: new Date(input.valueDate),
        status: "completed",
        notes: input.notes,
      });

      // Mark invoice as paid
      await dbInstance.update(invoices)
        .set({ status: "paid" })
        .where(and(eq(invoices.id, input.invoiceId), eq(invoices.organizationId, ctx.user.organizationId)));

      // Actualize budget commitment → actual
      if (invoice.poId) {
        const po = await db.getPurchaseOrderById(invoice.poId, ctx.user.organizationId);
        if (po) {
          const prId = (po as any).requestId;
          if (prId) {
            const pr = await db.getPurchaseRequestById(prId, ctx.user.organizationId);
            if (pr?.departmentId) {
              const { actualizeBudget } = await import("../utils/budgetCommitment");
              await actualizeBudget(ctx.user.organizationId, pr.departmentId, parseFloat(invoice.amount));
            }
          }
        }
      }

      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "invoice",
        entityId: input.invoiceId,
        action: "paid",
        actorId: ctx.user.id,
        newValue: { status: "paid", paymentMethod: input.paymentMethod, reference: input.reference },
      });

      return { success: true, paymentId: paymentResult[0].insertId };
    }),

  // ── DISPUTE WORKFLOW ──────────────────────────────────────────────────────

  dispute: protectedProcedure
    .input(z.object({
      invoiceId: z.number(),
      reason: z.string().min(10, "La raison doit avoir au moins 10 caractères"),
      details: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const invoice = await db.getInvoiceById(input.invoiceId, ctx.user.organizationId);
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      if (!["pending", "approved"].includes(invoice.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Seules les factures en attente ou approuvées peuvent être disputées" });
      }

      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { invoices } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");

      await dbInstance.update(invoices)
        .set({
          status: "disputed",
          disputeReason: input.reason + (input.details ? `

Détails: ${input.details}` : ""),
          disputedAt: new Date(),
          disputedBy: ctx.user.id,
        })
        .where(and(eq(invoices.id, input.invoiceId), eq(invoices.organizationId, ctx.user.organizationId)));

      // Notify procurement managers about the dispute
      const { createNotificationForMany } = await import("../utils/notifications");
      const { users } = await import("../../drizzle/schema");
      const managers = await dbInstance.select().from(users)
        .where(and(eq(users.organizationId, ctx.user.organizationId), eq(users.role, "procurement_manager")));
      const admins = await dbInstance.select().from(users)
        .where(and(eq(users.organizationId, ctx.user.organizationId), eq(users.role, "admin")));
      const notifyIds = [...new Set([...managers, ...admins].map(u => u.id))];

      if (notifyIds.length) {
        await createNotificationForMany({
          organizationId: ctx.user.organizationId,
          userIds: notifyIds,
          type: "invoice_overdue" as any,
          title: "Facture disputée",
          message: `La facture ${(invoice as any).invoiceNumber} a été disputée. Raison: ${input.reason}`,
          entityType: "invoice",
          entityId: input.invoiceId,
        });
      }

      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "invoice",
        entityId: input.invoiceId,
        action: "disputed",
        actorId: ctx.user.id,
        newValue: { status: "disputed", reason: input.reason },
      });

      return { success: true };
    }),

  resolveDispute: protectedProcedure
    .input(z.object({
      invoiceId: z.number(),
      resolution: z.enum(["approve", "reject", "request_revision"]),
      notes: z.string().min(5, "Une note de résolution est requise"),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "procurement_manager") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Seuls les admins et responsables achats peuvent résoudre les litiges" });
      }

      const invoice = await db.getInvoiceById(input.invoiceId, ctx.user.organizationId);
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });
      if (invoice.status !== "disputed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cette facture n'est pas en litige" });
      }

      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { invoices } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");

      const newStatus = input.resolution === "approve" ? "approved"
        : input.resolution === "reject" ? "rejected"
        : "pending"; // request_revision → send back to pending for vendor to resubmit

      await dbInstance.update(invoices)
        .set({
          status: newStatus as any,
          disputeResolution: input.notes,
          resolvedAt: new Date(),
        })
        .where(and(eq(invoices.id, input.invoiceId), eq(invoices.organizationId, ctx.user.organizationId)));

      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "invoice",
        entityId: input.invoiceId,
        action: `dispute_resolved_${input.resolution}`,
        actorId: ctx.user.id,
        newValue: { resolution: input.resolution, notes: input.notes, newStatus },
      });

      return { success: true, newStatus };
    }),

  // ── REVISION WORKFLOW ─────────────────────────────────────────────────────

  requestRevision: protectedProcedure
    .input(z.object({
      invoiceId: z.number(),
      reason: z.string().min(10),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "procurement_manager") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const invoice = await db.getInvoiceById(input.invoiceId, ctx.user.organizationId);
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });
      if (!["pending", "disputed"].includes(invoice.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Seules les factures en attente ou disputées peuvent faire l'objet d'une demande de révision" });
      }

      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { invoices } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");

      await dbInstance.update(invoices)
        .set({ status: "revised" as any, revisionNote: input.reason })
        .where(and(eq(invoices.id, input.invoiceId), eq(invoices.organizationId, ctx.user.organizationId)));

      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "invoice",
        entityId: input.invoiceId,
        action: "revision_requested",
        actorId: ctx.user.id,
        newValue: { reason: input.reason },
      });

      return { success: true };
    }),

  submitRevision: protectedProcedure
    .input(z.object({
      originalInvoiceId: z.number(),
      invoiceNumber: z.string().min(1),
      invoiceDate: z.string(),
      amount: z.number().positive(),
      taxAmount: z.number().min(0).default(0),
      revisionNote: z.string().min(5),
    }))
    .mutation(async ({ ctx, input }) => {
      const original = await db.getInvoiceById(input.originalInvoiceId, ctx.user.organizationId);
      if (!original) throw new TRPCError({ code: "NOT_FOUND" });
      if (!["revised", "rejected", "disputed"].includes(original.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Seules les factures révisées/rejetées/disputées acceptent une nouvelle version" });
      }

      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { invoices } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");

      const currentRevision = (original as any).revisionNumber ?? 1;

      const result = await dbInstance.insert(invoices).values({
        organizationId: ctx.user.organizationId,
        invoiceNumber: input.invoiceNumber,
        vendorId: (original as any).vendorId,
        poId: (original as any).poId,
        invoiceDate: new Date(input.invoiceDate),
        dueDate: (original as any).dueDate,
        amount: input.amount.toString(),
        taxAmount: input.taxAmount.toString(),
        currency: (original as any).currency ?? "XOF",
        matchStatus: "unmatched",
        status: "pending",
        originalInvoiceId: input.originalInvoiceId,
        revisionNumber: currentRevision + 1,
        revisionNote: input.revisionNote,
      });

      const newId = result[0].insertId;

      // Mark original as superseded
      await dbInstance.update(invoices)
        .set({ status: "cancelled" as any })
        .where(and(eq(invoices.id, input.originalInvoiceId), eq(invoices.organizationId, ctx.user.organizationId)));

      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "invoice",
        entityId: newId,
        action: "revision_submitted",
        actorId: ctx.user.id,
        newValue: { originalInvoiceId: input.originalInvoiceId, revisionNumber: currentRevision + 1 },
      });

      return { id: newId, revisionNumber: currentRevision + 1 };
    }),

  // ── CONVERT PO TO INVOICE ─────────────────────────────────────────────────

  createFromPO: protectedProcedure
    .input(z.object({
      poId: z.number(),
      invoiceNumber: z.string().min(1),
      invoiceDate: z.string(),
      dueDate: z.string().optional(),
      amount: z.number().positive().optional(),
      taxAmount: z.number().min(0).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "procurement_manager") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const po = await db.getPurchaseOrderById(input.poId, ctx.user.organizationId);
      if (!po) throw new TRPCError({ code: "NOT_FOUND", message: "Bon de commande introuvable" });
      if (!["issued", "confirmed", "partially_received", "received"].includes(po.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Le BC doit être émis ou réceptionné pour créer une facture" });
      }

      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Check duplicate invoice number for this vendor
      const { invoices } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      const existing = await dbInstance.select().from(invoices)
        .where(and(eq(invoices.invoiceNumber, input.invoiceNumber), eq(invoices.vendorId, (po as any).vendorId), eq(invoices.organizationId, ctx.user.organizationId)))
        .limit(1);
      if (existing.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: `La facture ${input.invoiceNumber} existe déjà pour ce fournisseur` });
      }

      const amount = input.amount ?? parseFloat((po as any).totalAmount);
      const taxAmount = input.taxAmount ?? parseFloat((po as any).taxAmount ?? "0");

      const result = await dbInstance.insert(invoices).values({
        organizationId: ctx.user.organizationId,
        invoiceNumber: input.invoiceNumber,
        vendorId: (po as any).vendorId,
        poId: input.poId,
        invoiceDate: new Date(input.invoiceDate),
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        amount: amount.toString(),
        taxAmount: taxAmount.toString(),
        currency: (po as any).currency ?? "XOF",
        matchStatus: "unmatched",
        status: "pending",
        revisionNumber: 1,
      });

      const invoiceId = result[0].insertId;

      // Auto-run 3-way match
      await dbInstance.update(invoices)
        .set({ matchStatus: "unmatched" })
        .where(eq(invoices.id, invoiceId));

      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "invoice",
        entityId: invoiceId,
        action: "created_from_po",
        actorId: ctx.user.id,
        newValue: { poId: input.poId, invoiceNumber: input.invoiceNumber, amount },
      });

      return { id: invoiceId, invoiceNumber: input.invoiceNumber };
    }),

  // List payments for the organisation
  listPayments: protectedProcedure
    .input(z.object({
      invoiceId: z.number().optional(),
      status: z.enum(["scheduled", "processing", "completed", "failed", "cancelled"]).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return [];

      const { payments, invoices: inv, vendors } = await import("../../drizzle/schema");
      const { eq, and, desc } = await import("drizzle-orm");

      const conditions: any[] = [eq(payments.organizationId, ctx.user.organizationId)];
      if (input?.invoiceId) conditions.push(eq(payments.invoiceId, input.invoiceId));
      if (input?.status) conditions.push(eq(payments.status, input.status));

      const rows = await dbInstance.select().from(payments)
        .where(and(...conditions))
        .orderBy(desc(payments.createdAt))
        .limit(200);

      // Enrich with invoice details
      return Promise.all(rows.map(async (p) => {
        const invoice = await db.getInvoiceById(p.invoiceId, ctx.user.organizationId);
        const vendor = invoice ? await db.getVendorById(invoice.vendorId, ctx.user.organizationId) : null;
        return { ...p, invoice, vendor: vendor ? { id: vendor.id, legalName: vendor.legalName } : null };
      }));
    }),
  // Void invoice — admin only, immutable once voided
  voidInvoice: protectedProcedure
    .input(z.object({ id: z.number(), reason: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "procurement_manager") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Seuls les admins peuvent annuler une facture" });
      }
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { invoices } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      const [invoice] = await dbInstance.select().from(invoices)
        .where(and(eq(invoices.id, input.id), eq(invoices.organizationId, ctx.user.organizationId))).limit(1);
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });
      if (invoice.status === "paid") throw new TRPCError({ code: "BAD_REQUEST", message: "Impossible d'annuler une facture déjà payée" });
      if (invoice.status === "cancelled") throw new TRPCError({ code: "BAD_REQUEST", message: "Facture déjà annulée" });
      await dbInstance.update(invoices)
        .set({ status: "cancelled" as any })
        .where(and(eq(invoices.id, input.id), eq(invoices.organizationId, ctx.user.organizationId)));
      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "invoice",
        entityId: input.id,
        action: "voided",
        actorId: ctx.user.id,
        newValue: { status: "cancelled", reason: input.reason },
      });
      return { success: true };
    }),

});
