import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { TRPCError } from "@trpc/server";
import { createAuditLog } from "../db";

const createRequestSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  categoryId: z.number().optional(),
  billingStringId: z.number().optional(),
  costCenterId: z.number().optional(),
  projectId: z.number().optional(),
  departmentId: z.number().optional(),
  amountEstimate: z.number().positive(),
  taxIncluded: z.boolean().default(false),
  urgencyLevel: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  items: z.array(z.object({
    itemName: z.string(),
    description: z.string().optional(),
    quantity: z.number().positive(),
    unitPrice: z.number().positive(),
    unit: z.string().optional(),
    preferredVendorId: z.number().optional(),
  })),
  attachments: z.array(z.object({
    filename: z.string(),
    url: z.string(),
    uploadedAt: z.string(),
  })).optional(),
});

const updateRequestSchema = z.object({
  id: z.number(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  categoryId: z.number().optional(),
  billingStringId: z.number().optional(),
  costCenterId: z.number().optional(),
  projectId: z.number().optional(),
  departmentId: z.number().optional(),
  amountEstimate: z.number().positive().optional(),
  taxIncluded: z.boolean().optional(),
  urgencyLevel: z.enum(["low", "medium", "high", "critical"]).optional(),
  status: z.enum(["draft", "submitted", "pending_approval", "approved", "rejected", "cancelled"]).optional(),
});

export const purchaseRequestsRouter = router({
  list: protectedProcedure
    .input(z.object({
      status: z.string().optional(),
      departmentId: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const requests = await db.getPurchaseRequests(ctx.user.organizationId, input);
      return requests;
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const request = await db.getPurchaseRequestById(input.id, ctx.user.organizationId);
      if (!request) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Purchase request not found" });
      }
      // Enrich with requester info
      const requester = request.requesterId ? await db.getUserById(request.requesterId) : null;
      return {
        ...request,
        requester: requester ? { id: requester.id, name: requester.name, email: requester.email } : null,
      };
    }),

  create: protectedProcedure
    .input(createRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const { items, ...requestData } = input;
      
      // Generate request number using org-configured prefix
      const { getOrgSettings } = await import("../utils/orgSettings");
      const orgCfg = await getOrgSettings(ctx.user.organizationId);
      const prPrefix = orgCfg.numberingSequences.prPrefix || "DA";
      const timestamp = Date.now();
      const requestNumber = `${prPrefix}-${timestamp.toString().slice(-8)}`;
      
      const requestId = await db.createPurchaseRequest({
        ...requestData,
        organizationId: ctx.user.organizationId,
        requesterId: ctx.user.id,
        requestNumber,
        status: "draft",
        currency: "XOF",
      });

      // Create request items
      const dbInstance = await db.getDb();
      if (dbInstance) {
        const { purchaseRequestItems } = await import("../../drizzle/schema");
        for (const item of items) {
          const totalPrice = item.quantity * item.unitPrice;
          await dbInstance.insert(purchaseRequestItems).values({
            requestId,
            itemName: item.itemName,
            description: item.description,
            quantity: item.quantity.toString(),
            unitPrice: item.unitPrice.toString(),
            totalPrice: totalPrice.toString(),
            unit: item.unit,
            preferredVendorId: item.preferredVendorId,
          });
        }
      }

      // Audit log
      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "purchaseRequest",
        entityId: requestId,
        action: "created",
        actorId: ctx.user.id,
        newValue: { requestNumber, ...requestData },
      });

      return { id: requestId, requestNumber };
    }),

  update: protectedProcedure
    .input(updateRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;
      
      const existing = await db.getPurchaseRequestById(id, ctx.user.organizationId);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Purchase request not found" });
      }

      // Check permissions: only requester or admin can update
      if (existing.requesterId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized to update this request" });
      }

      // Can only update draft requests
      if (existing.status !== "draft" && updateData.status !== "cancelled") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot update non-draft requests" });
      }

      await db.updatePurchaseRequest(id, ctx.user.organizationId, updateData);

      // Audit log
      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "purchaseRequest",
        entityId: id,
        action: "updated",
        actorId: ctx.user.id,
        oldValue: existing,
        newValue: updateData,
      });

      return { success: true };
    }),

  submit: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const request = await db.getPurchaseRequestById(input.id, ctx.user.organizationId);
      if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "Purchase request not found" });
      if (request.status !== "draft") throw new TRPCError({ code: "BAD_REQUEST", message: "Only draft requests can be submitted" });
      if (request.requesterId !== ctx.user.id && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" });

      // Read org workflow settings
      const { getOrgSettings } = await import("../utils/orgSettings");
      const orgCfg = await getOrgSettings(ctx.user.organizationId);
      const wf = orgCfg.workflowSettings;
      const bp = orgCfg.budgetPolicies;

      // Enforce: justification required
      if (wf.requireJustification && !request.description?.trim()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Une justification est obligatoire. Veuillez ajouter une description à votre demande." });
      }

      // Enforce: budget check
      if (bp.enforceBudgetCheck && request.departmentId) {
        const dbInstance = await db.getDb();
        if (dbInstance) {
          const { budgets } = await import("../../drizzle/schema");
          const { eq, and } = await import("drizzle-orm");
          const now = new Date();
          const period = `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`;
          const [budget] = await dbInstance.select().from(budgets)
            .where(and(eq(budgets.organizationId, ctx.user.organizationId), eq(budgets.scopeType, "department"), eq(budgets.scopeId, request.departmentId), eq(budgets.fiscalPeriod, period))).limit(1);
          if (budget) {
            const allocated = parseFloat(budget.allocatedAmount);
            const used = parseFloat(budget.committedAmount ?? "0") + parseFloat(budget.actualAmount ?? "0");
            const available = allocated - used;
            const amount = parseFloat(request.amountEstimate);
            if (available < amount && !bp.allowOverspend) {
              throw new TRPCError({ code: "BAD_REQUEST", message: `Budget insuffisant. Disponible: ${available.toLocaleString("fr-FR")} XOF, Demandé: ${amount.toLocaleString("fr-FR")} XOF` });
            }
          }
        }
      }

      const amount = parseFloat(request.amountEstimate);

      // Auto-approve if below configured threshold
      if (wf.autoApproveAmount > 0 && amount <= wf.autoApproveAmount) {
        await db.updatePurchaseRequest(input.id, ctx.user.organizationId, { status: "approved" });
        const { commitBudget } = await import("../utils/budgetCommitment");
        await commitBudget(ctx.user.organizationId, request.departmentId, amount);
        await createAuditLog({ organizationId: ctx.user.organizationId, entityType: "purchaseRequest", entityId: input.id, action: "auto_approved", actorId: ctx.user.id, newValue: { status: "approved", reason: `Amount ${amount} ≤ auto-approve threshold ${wf.autoApproveAmount}` } });
        return { success: true, status: "approved", autoApproved: true };
      }

      // Create approval chain
      const { createApprovalChain } = await import("../utils/approvalRouter");
      const approvalResult = await createApprovalChain(ctx.user.organizationId, input.id, {
        id: request.id, departmentId: request.departmentId,
        totalAmount: request.amountEstimate, urgency: request.urgencyLevel, requesterId: request.requesterId,
      });

      const newStatus = approvalResult.approvalCount > 0 ? "pending_approval" : "approved";
      await db.updatePurchaseRequest(input.id, ctx.user.organizationId, { status: newStatus });

      await createAuditLog({ organizationId: ctx.user.organizationId, entityType: "purchaseRequest", entityId: input.id, action: "submitted", actorId: ctx.user.id, oldValue: { status: request.status }, newValue: { status: newStatus } });
      return { success: true, status: newStatus };
    }),

  cancel: protectedProcedure
    .input(z.object({ id: z.number(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const request = await db.getPurchaseRequestById(input.id, ctx.user.organizationId);
      if (!request) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Purchase request not found" });
      }

      if (request.requesterId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" });
      }

      await db.updatePurchaseRequest(input.id, ctx.user.organizationId, {
        status: "cancelled",
      });

      // Release any committed budget if the request was approved/pending
      if (["pending_approval", "approved"].includes(request.status) && request.departmentId) {
        const { releaseBudgetCommitment } = await import("../utils/budgetCommitment");
        await releaseBudgetCommitment(
          ctx.user.organizationId,
          request.departmentId,
          parseFloat(request.amountEstimate)
        );
      }

      // Audit log
      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "purchaseRequest",
        entityId: input.id,
        action: "cancelled",
        actorId: ctx.user.id,
        oldValue: { status: request.status },
        newValue: { status: "cancelled", reason: input.reason },
      });

      return { success: true };
    }),

  getMyRequests: protectedProcedure
    .query(async ({ ctx }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return [];
      
      const { purchaseRequests } = await import("../../drizzle/schema");
      const { eq, and, desc } = await import("drizzle-orm");
      
      return dbInstance.select().from(purchaseRequests)
        .where(and(
          eq(purchaseRequests.organizationId, ctx.user.organizationId),
          eq(purchaseRequests.requesterId, ctx.user.id)
        ))
        .orderBy(desc(purchaseRequests.createdAt));
    }),

  getRequestItems: protectedProcedure
    .input(z.object({ requestId: z.number() }))
    .query(async ({ ctx, input }) => {
      const request = await db.getPurchaseRequestById(input.requestId, ctx.user.organizationId);
      if (!request) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Purchase request not found" });
      }

      const dbInstance = await db.getDb();
      if (!dbInstance) return [];
      
      const { purchaseRequestItems } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      
      return dbInstance.select().from(purchaseRequestItems)
        .where(eq(purchaseRequestItems.requestId, input.requestId));
    }),

  // Admin bypass approval - directly approve without going through approval chain
  adminBypassApproval: protectedProcedure
    .input(z.object({ 
      id: z.number(),
      comment: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Only admins can bypass approvals
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only administrators can bypass approvals" });
      }

      const request = await db.getPurchaseRequestById(input.id, ctx.user.organizationId);
      if (!request) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Purchase request not found" });
      }

      if (request.status === "approved") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Request is already approved" });
      }

      if (request.status === "rejected" || request.status === "cancelled") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot approve rejected or cancelled requests" });
      }

      const dbInstance = await db.getDb();
      if (!dbInstance) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      }

      const { purchaseRequests, approvals } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");

      // Update request status to approved
      await dbInstance.update(purchaseRequests)
        .set({ 
          status: "approved",
          updatedAt: new Date(),
        })
        .where(and(
          eq(purchaseRequests.id, input.id),
          eq(purchaseRequests.organizationId, ctx.user.organizationId)
        ));

      // Mark all pending approvals as approved by admin
      await dbInstance.update(approvals)
        .set({
          decision: "approved",
          decidedAt: new Date(),
          comment: input.comment || "Approved by administrator (bypassed approval chain)",
        })
        .where(and(
          eq(approvals.requestId, input.id),
          eq(approvals.decision, "pending")
        ));

      // Audit log
      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "purchaseRequest",
        entityId: input.id,
        action: "approved",
        actorId: ctx.user.id,
        oldValue: { status: request.status },
        newValue: { 
          status: "approved",
          bypassedBy: ctx.user.name,
          comment: input.comment || "Admin bypass",
        },
      });

      return { success: true };
    }),
});
