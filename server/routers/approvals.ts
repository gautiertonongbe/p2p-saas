
// ── Centralized State Machine ────────────────────────────────────────────────
// Allowed transitions. Enforced individually in each mutation.
// This is the single source of truth — never add transitions outside this map.
export const PURCHASE_REQUEST_TRANSITIONS: Record<string, string[]> = {
  "draft":            ["submitted", "cancelled"],
  "submitted":        ["pending_approval", "approved", "cancelled"],
  "pending_approval": ["approved", "rejected", "cancelled"],
  "approved":         ["cancelled"],  // can cancel but not edit
  "rejected":         ["draft"],      // via resubmit only
  "cancelled":        [],             // terminal state
};

export const INVOICE_TRANSITIONS: Record<string, string[]> = {
  "pending":          ["approved", "rejected", "disputed"],
  "pending_approval": ["approved", "rejected", "disputed"],
  "approved":         ["paid", "disputed"],
  "disputed":         ["pending_approval", "rejected"],
  "paid":             [],             // terminal state
  "rejected":         ["pending_approval"],  // via revision
  "cancelled":        [],             // terminal state
};

export function assertValidTransition(
  entity: string, from: string, to: string,
  machine: Record<string, string[]>
) {
  const allowed = machine[from] ?? [];
  if (!allowed.includes(to)) {
    throw new Error(
      `Transition invalide [${entity}]: ${from} → ${to}. ` +
      `Transitions autorisées depuis '${from}': [${allowed.join(", ") || "aucune"}]`
    );
  }
}

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
const safe = (s: string) => String(s || "").replace(/'/g, "''");
import { TRPCError } from "@trpc/server";
import { createAuditLog } from "../db";

export const approvalsRouter = router({
  // Get pending approvals for current user
  myPendingApprovals: protectedProcedure
    .query(async ({ ctx }) => {
      const approvals = await db.getPendingApprovals(ctx.user.id);
      
      // Enrich with request details
      const enriched = await Promise.all(approvals.map(async (approval) => {
        const request = await db.getPurchaseRequestById(approval.requestId, ctx.user.organizationId);
        return {
          ...approval,
          request,
        };
      }));
      
      return enriched;
    }),

  // Get completed approvals for current user (approved/rejected/delegated)
  myCompletedApprovals: protectedProcedure
    .query(async ({ ctx }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return [];

      const { approvals } = await import("../../drizzle/schema");
      const { eq, and, ne, desc } = await import("drizzle-orm");

      // Org-safe: only return approvals for requests in this org
      const { purchaseRequests: prs } = await import("../../drizzle/schema");
      const orgRequestIds = (await dbInstance.select({ id: prs.id }).from(prs)
        .where(eq(prs.organizationId, ctx.user.organizationId))).map(r => r.id);

      const completed = orgRequestIds.length > 0
        ? await dbInstance.select().from(approvals)
            .where(and(
              eq(approvals.approverId, ctx.user.id),
              ne(approvals.decision, "pending")
            ))
            .orderBy(desc(approvals.decidedAt))
            .limit(100)
            .then(rows => rows.filter(r => orgRequestIds.includes(r.requestId)))
        : [];

      // Enrich with request details
      const enriched = await Promise.all(completed.map(async (approval) => {
        const request = await db.getPurchaseRequestById(approval.requestId, ctx.user.organizationId);
        return {
          ...approval,
          request,
        };
      }));

      return enriched.filter(a => a.request !== undefined);
    }),

  // Get approval history for a request

  // Get approvals for any entity type (PR, PO, Invoice)
  getByEntity: protectedProcedure
    .input(z.object({ 
      entityType: z.enum(["purchaseRequest", "purchaseOrder", "invoice"]),
      entityId: z.number() 
    }))
    .query(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return [];
      try {
        // For PO/Invoice, find linked PR and return its approvals
        let requestId = input.entityId;
        if (input.entityType === "purchaseOrder") {
          const res = await dbInstance.execute(`SELECT requestId FROM purchaseOrders WHERE id = ${input.entityId} AND organizationId = ${ctx.user.organizationId} LIMIT 1`);
          const row = (res as any)[0]?.[0];
          if (!row?.requestId) return [];
          requestId = row.requestId;
        } else if (input.entityType === "invoice") {
          // Try to get approvals from linked PR via PO
          const res = await dbInstance.execute(`SELECT po.requestId, inv.approvedBy, inv.approvedAt, inv.status FROM invoices inv LEFT JOIN purchaseOrders po ON inv.poId = po.id WHERE inv.id = ${input.entityId} AND inv.organizationId = ${ctx.user.organizationId} LIMIT 1`);
          const row = (res as any)[0]?.[0];
          if (row?.requestId) {
            requestId = row.requestId;
          } else if (row?.approvedBy) {
            // Direct approval — synthesize a single approval record from the invoice itself
            const approver = await db.getUserById(row.approvedBy);
            return [{
              id: -1, requestId: input.entityId, stepOrder: 1,
              approverId: row.approvedBy, decision: "approved" as const,
              comment: null, decidedAt: row.approvedAt, dueAt: null,
              isParallel: false, policyName: "Approbation directe",
              approver: approver ? { id: approver.id, name: approver.name, email: approver.email, role: approver.role } : null,
            }];
          } else {
            return [];
          }
        }
        const approvals = await db.getApprovalsByRequest(requestId);
        const enriched = await Promise.all(approvals.map(async (approval) => {
          const approver = await db.getUserById(approval.approverId);
          return { ...approval, approver: approver ? { id: approver.id, name: approver.name, email: approver.email, role: approver.role } : null };
        }));
        return enriched;
      } catch { return []; }
    }),

  getByRequest: protectedProcedure
    .input(z.object({ requestId: z.number() }))
    .query(async ({ ctx, input }) => {
      const request = await db.getPurchaseRequestById(input.requestId, ctx.user.organizationId);
      if (!request) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Purchase request not found" });
      }

      const approvals = await db.getApprovalsByRequest(input.requestId);
      
      // Enrich with approver details
      const enriched = await Promise.all(approvals.map(async (approval) => {
        const approver = await db.getUserById(approval.approverId);
        return {
          ...approval,
          approver: approver ? { id: approver.id, name: approver.name, email: approver.email } : null,
        };
      }));
      
      return enriched;
    }),

  // Approve a request
  approve: protectedProcedure
    .input(z.object({
      approvalId: z.number(),
      comment: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      
      const { approvals } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      
      const approval = await dbInstance.select().from(approvals)
        .where(and(
          eq(approvals.id, input.approvalId),
          eq(approvals.approverId, ctx.user.id)
        ))
        .limit(1);
      
      if (approval.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Approval not found or not assigned to you" });
      }
      
      const currentApproval = approval[0];
      
      if (currentApproval.decision !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST",
          message: `Action déjà effectuée — cette approbation a déjà été traitée (décision: ${currentApproval.decision}). Rafraîchissez la page.` });
      }

      // Segregation of duties: read from org settings (admins always exempt)
      const sodRequest = await db.getPurchaseRequestById(currentApproval.requestId, ctx.user.organizationId);
      if (sodRequest && sodRequest.requesterId === ctx.user.id && ctx.user.role !== "admin") {
        const { getOrgSettings } = await import("../utils/orgSettings");
        const orgCfg = await getOrgSettings(ctx.user.organizationId);
        if (orgCfg.workflowSettings.segregationOfDuties) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Vous ne pouvez pas approuver votre propre demande (séparation des fonctions)",
          });
        }
      }

      // ── B: Atomic update — WHERE decision='pending' prevents race conditions ──
      // If two approvers click simultaneously, only one UPDATE will succeed (rowsAffected=1)
      const dbInstance2 = await db.getDb();
      if (!dbInstance2) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const now = new Date();
      const result = await dbInstance2.execute(
        `UPDATE approvals
         SET decision = 'approved', comment = ${input.comment ? `'${input.comment.replace(/'/g, "''")}'` : 'NULL'}, decidedAt = NOW()
         WHERE id = ${input.approvalId}
           AND approverId = ${ctx.user.id}
           AND decision = 'pending'`
      ) as any;
      const rowsAffected = result[0]?.affectedRows ?? 0;
      if (rowsAffected === 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Cette approbation a déjà été traitée par un autre processus. Rafraîchissez la page.",
        });
      }

      // Update request status based on approval chain progress
      const { updateRequestStatus } = await import("../utils/approvalRouter");
      await updateRequestStatus(currentApproval.requestId);
      
      // Check if all approvals are complete
      const allApprovals = await db.getApprovalsByRequest(currentApproval.requestId);
      const allApproved = allApprovals.every(a => a.decision === "approved");

      // When fully approved: commit budget + notify requester
      if (allApproved) {
        const request = await db.getPurchaseRequestById(currentApproval.requestId, ctx.user.organizationId);
        if (request) {
          const { commitBudget } = await import("../utils/budgetCommitment");
          await commitBudget(
            ctx.user.organizationId,
            request.departmentId,
            parseFloat(request.amountEstimate)
          );

          const { createNotification } = await import("../utils/notifications");
          await createNotification({
            organizationId: ctx.user.organizationId,
            userId: request.requesterId,
            type: "approved",
            title: "Demande approuvée",
            message: `Votre demande "${request.title}" a été entièrement approuvée.`,
            entityType: "purchaseRequest",
            entityId: request.id,
          });
          // Email requester
          const requester = await db.getUserById(request.requesterId);
          if (requester?.email) {
            await sendApprovalDecisionEmail({
              to: requester.email,
              requesterName: requester.name || requester.email,
              requestTitle: request.title,
              requestNumber: request.requestNumber,
              decision: "approved",
              approverName: ctx.user.name || ctx.user.email || "Un approbateur",
              requestId: request.id,
            }).catch(e => console.error("[Email] Failed:", e));
          }
        }
      } else {
        // Notify next approver(s)
        const nextPending = allApprovals.filter(a => a.decision === "pending");
        if (nextPending.length > 0) {
          const request = await db.getPurchaseRequestById(currentApproval.requestId, ctx.user.organizationId);
          const { createNotificationForMany } = await import("../utils/notifications");
          await createNotificationForMany({
            organizationId: ctx.user.organizationId,
            userIds: nextPending.map(a => a.approverId),
            type: "approval_required",
            title: "Approbation requise",
            message: `La demande "${request?.title}" attend votre approbation.`,
            entityType: "purchaseRequest",
            entityId: currentApproval.requestId,
          });
          // Send email to next approvers
          for (const pending of nextPending) {
            const approver = await db.getUserById(pending.approverId);
            if (approver?.email && request) {
              await sendApprovalRequestEmail({
                to: approver.email,
                approverName: approver.name || approver.email,
                requesterName: ctx.user.name || ctx.user.email || "Un utilisateur",
                requestTitle: request.title,
                requestNumber: request.requestNumber,
                amount: parseFloat(request.amountEstimate) || 0,
                approvalId: pending.id,
              }).catch(e => console.error("[Email] Failed:", e));
            }
          }
        }
      }

      // Audit log
      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "approval",
        entityId: input.approvalId,
        action: "approved",
        actorId: ctx.user.id,
        newValue: { decision: "approved", comment: input.comment },
      });

      return { success: true, allApproved };
    }),

  // Reject a request
  reject: protectedProcedure
    .input(z.object({
      approvalId: z.number(),
      comment: z.string().min(1, "Rejection reason is required"),
    }))
    .mutation(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      
      const { approvals } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      
      const approval = await dbInstance.select().from(approvals)
        .where(and(
          eq(approvals.id, input.approvalId),
          eq(approvals.approverId, ctx.user.id)
        ))
        .limit(1);
      
      if (approval.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Approval not found or not assigned to you" });
      }
      
      const currentApproval = approval[0];
      
      if (currentApproval.decision !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST",
          message: `Action déjà effectuée — cette approbation a déjà été traitée (décision: ${currentApproval.decision}). Rafraîchissez la page.` });
      }

      // Update approval
      // Atomic reject — WHERE decision='pending'
      const dbRej = await db.getDb();
      if (!dbRej) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rejResult = await dbRej.execute(
        `UPDATE approvals
         SET decision = 'rejected', comment = ${input.comment ? `'${input.comment.replace(/'/g, "''")}'` : 'NULL'}, decidedAt = NOW()
         WHERE id = ${input.approvalId}
           AND approverId = ${ctx.user.id}
           AND decision = 'pending'`
      ) as any;
      if ((rejResult[0]?.affectedRows ?? 0) === 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Cette approbation a déjà été traitée. Rafraîchissez la page.",
        });
      }

      // Update request status based on approval chain
      const { updateRequestStatus } = await import("../utils/approvalRouter");
      await updateRequestStatus(currentApproval.requestId);

      // Notify requester of rejection
      const rejectedRequest = await db.getPurchaseRequestById(currentApproval.requestId, ctx.user.organizationId);
      if (rejectedRequest) {
        const { createNotification } = await import("../utils/notifications");
        await createNotification({
          organizationId: ctx.user.organizationId,
          userId: rejectedRequest.requesterId,
          type: "rejected",
          title: "Demande rejetée",
          message: `Votre demande "${rejectedRequest.title}" a été rejetée. Raison: ${safe(input.comment)}`,
          entityType: "purchaseRequest",
          entityId: rejectedRequest.id,
        });
      }

      // Audit log
      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "approval",
        entityId: input.approvalId,
        action: "rejected",
        actorId: ctx.user.id,
        newValue: { decision: "rejected", comment: input.comment },
      });

      return { success: true };
    }),

  // Delegate approval to another user
  delegate: protectedProcedure
    .input(z.object({
      approvalId: z.number(),
      delegateToUserId: z.number(),
      comment: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      
      const { approvals } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      
      const approval = await dbInstance.select().from(approvals)
        .where(and(
          eq(approvals.id, input.approvalId),
          eq(approvals.approverId, ctx.user.id)
        ))
        .limit(1);
      
      if (approval.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Approval not found or not assigned to you" });
      }
      
      const currentApproval = approval[0];
      
      if (currentApproval.decision !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST",
          message: `Action déjà effectuée — cette approbation a déjà été traitée (décision: ${currentApproval.decision}). Rafraîchissez la page.` });
      }

      // Verify delegate user exists and is in same org
      const delegateUser = await db.getUserById(input.delegateToUserId);
      if (!delegateUser || delegateUser.organizationId !== ctx.user.organizationId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid delegate user" });
      }

      // Update approval
      await db.updateApproval(input.approvalId, {
        decision: "delegated",
        delegatedTo: input.delegateToUserId,
        comment: input.comment,
        decidedAt: new Date(),
      });

      // Create new approval for delegate
      await db.createApproval({
        requestId: currentApproval.requestId,
        stepOrder: currentApproval.stepOrder,
        approverId: input.delegateToUserId,
        decision: "pending",
      });

      // Audit log
      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "approval",
        entityId: input.approvalId,
        action: "delegated",
        actorId: ctx.user.id,
        newValue: { delegatedTo: input.delegateToUserId, comment: input.comment },
      });

      return { success: true };
    }),

  // Get approval policies
  getPolicies: protectedProcedure
    .query(async ({ ctx }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return [];
      
      const { approvalPolicies } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      
      return dbInstance.select().from(approvalPolicies)
        .where(and(
          eq(approvalPolicies.organizationId, ctx.user.organizationId),
          eq(approvalPolicies.isActive, true)
        ));
    }),
});
