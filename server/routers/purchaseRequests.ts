import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
const safe = (s: string) => String(s || "").replace(/'/g, "''");
import { TRPCError } from "@trpc/server";
import { createAuditLog } from "../db";

const createRequestSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  justification: z.string().optional(),
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
  justification: z.string().optional(),
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
      // Exclude archived documents from default list
      const filtered = requests.filter((r: any) => !r.isArchived);
      return filtered;
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
      justification: input.justification,
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
    .input(z.object({
      id: z.number(),
      idempotencyKey: z.string().optional(), // client-generated UUID per click
    }))
    .mutation(async ({ ctx, input }) => {
      const request = await db.getPurchaseRequestById(input.id, ctx.user.organizationId);
      if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "Purchase request not found" });
      if (request.status !== "draft") throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Cette demande a déjà été soumise ou n'est plus modifiable (statut actuel: " + request.status + ")",
      });
      if (request.requesterId !== ctx.user.id && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" });

      // Read org workflow settings
      const { getOrgSettings } = await import("../utils/orgSettings");
      const orgCfg = await getOrgSettings(ctx.user.organizationId);
      const wf = orgCfg.workflowSettings;
      const bp = orgCfg.budgetPolicies;

      // Enforce: justification required
      if (wf.requireJustification && !request.description?.trim()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Une justification est obligatoire. Veuillez ajouter une justification à votre demande." });
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

      // Only auto-approve if approvalCount > 0 was expected (not due to missing policy)
      // If no policy configured: keep as submitted, admin must configure workflow or bypass
      const newStatus = approvalResult.approvalCount > 0
        ? "pending_approval"
        : (approvalResult as any).noPolicy
          ? "submitted"  // no workflow configured - stays submitted for admin action
          : "approved";  // policy existed but 0 steps = intentional auto-approve
      await db.updatePurchaseRequest(input.id, ctx.user.organizationId, { status: newStatus });

      // Email first approvers
      if (newStatus === "pending_approval" && approvalResult.firstApprovers?.length > 0) {
        for (const approverId of approvalResult.firstApprovers) {
          const approver = await db.getUserById(approverId);
          const approvalRecord = (await db.getApprovalsByRequest(input.id)).find(a => a.approverId === approverId);
          if (approver?.email && approvalRecord) {
            await sendApprovalRequestEmail({
              to: approver.email,
              approverName: approver.name || approver.email,
              requesterName: ctx.user.name || ctx.user.email || "Un utilisateur",
              requestTitle: request.title,
              requestNumber: request.requestNumber,
              amount: parseFloat(request.amountEstimate) || 0,
              approvalId: approvalRecord.id,
            }).catch(e => console.error("[Email] Failed:", e));
          }
        }
      }

      await createAuditLog({ organizationId: ctx.user.organizationId, entityType: "purchaseRequest", entityId: input.id, action: "submitted", actorId: ctx.user.id, oldValue: { status: request.status }, newValue: { status: newStatus } });
      return { success: true, status: newStatus };
    }),


  // Resubmit a rejected request — resets to draft, preserves audit history
  resubmit: protectedProcedure
    .input(z.object({
      id: z.number(),
      comment: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const request = await db.getPurchaseRequestById(input.id, ctx.user.organizationId);
      if (!request) throw new TRPCError({ code: "NOT_FOUND" });
      if (request.requesterId !== ctx.user.id && ctx.user.role !== "admin")
        throw new TRPCError({ code: "FORBIDDEN" });
      if (request.status !== "rejected")
        throw new TRPCError({ code: "BAD_REQUEST",
          message: "Seules les demandes rejetées peuvent être resoumises" });

      // Reset to draft so user can edit before resubmitting
      await db.updatePurchaseRequest(input.id, ctx.user.organizationId, { status: "draft" });

      // Clear pending approvals from previous cycle
      const dbInstance = await db.getDb();
      if (dbInstance) {
        await dbInstance.execute(
          `UPDATE approvals SET decision = 'voided', comment = 'Annulé — resoumission par le demandeur'
           WHERE requestId = ${input.id} AND decision = 'pending'`
        );
      }

      // Audit log — rejection reason remains in history, this is a NEW entry
      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "purchaseRequest",
        entityId: input.id,
        action: "resubmitted",
        actorId: ctx.user.id,
        newValue: { status: "draft", comment: input.comment, note: "Remis en brouillon pour correction avant resoumission" },
      });

      return { success: true, message: "Demande remise en brouillon — modifiez et soumettez à nouveau" };
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
