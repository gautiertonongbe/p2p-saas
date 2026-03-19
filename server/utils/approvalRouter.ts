import { getDb } from "../db";
import { approvalPolicies, approvalSteps, approvals, purchaseRequests, users } from "../../drizzle/schema";
import { eq, and, or } from "drizzle-orm";

// Production-safe logger — only verbose in development
const isDev = process.env.NODE_ENV === "development";
const log = isDev ? console.log.bind(console) : () => {};

interface ApprovalPolicy {
  id: number;
  name: string;
  conditions: {
    minAmount?: number;
    maxAmount?: number;
    categoryIds?: number[];
    departmentIds?: number[];
    urgencyLevels?: string[];
  } | null;
  priority: number | null;
}

interface ApprovalStep {
  id: number;
  policyId: number;
  stepOrder: number;
  approverType: "role" | "user" | "manager";
  approverId: number | null;
  isParallel: boolean;
}

interface PurchaseRequest {
  id: number;
  departmentId: number | null;
  totalAmount: string;
  urgency: string;
  requesterId: number;
}

/**
 * Find the matching approval policy for a purchase request.
 * Policies are evaluated in priority order; first match wins.
 */
export async function findMatchingPolicy(
  organizationId: number,
  request: PurchaseRequest
): Promise<ApprovalPolicy | null> {
  const db = await getDb();
  if (!db) return null;

  const policies = await db
    .select()
    .from(approvalPolicies)
    .where(and(
      eq(approvalPolicies.organizationId, organizationId),
      eq(approvalPolicies.isActive, true)
    ))
    .orderBy(approvalPolicies.priority);

  const amount = parseFloat(request.totalAmount);

  for (const policy of policies) {
    const c = policy.conditions;
    if (!c) continue;
    if (c.minAmount !== undefined && amount < c.minAmount) continue;
    if (c.maxAmount !== undefined && amount > c.maxAmount) continue;
    if (c.departmentIds?.length && (!request.departmentId || !c.departmentIds.includes(request.departmentId))) continue;
    if (c.urgencyLevels?.length && !c.urgencyLevels.includes(request.urgency)) continue;
    return policy;
  }

  return null;
}

/**
 * Return the ordered approval steps for a given policy.
 */
export async function getApprovalSteps(policyId: number): Promise<ApprovalStep[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(approvalSteps)
    .where(eq(approvalSteps.policyId, policyId))
    .orderBy(approvalSteps.stepOrder);
}

/**
 * Resolve which user IDs should approve a given step.
 */
export async function resolveApprover(
  organizationId: number,
  step: ApprovalStep,
  requesterId: number,
  departmentId: number | null
): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];

  switch (step.approverType) {
    case "user":
      return step.approverId ? [step.approverId] : [];

    case "role": {
      const roleMap: Record<number, string> = {
        1: "admin",
        2: "procurement_manager",
        3: "approver",
      };
      const roleName = step.approverId ? roleMap[step.approverId] : null;
      if (!roleName) return [];

      const roleUsers = await db.select().from(users).where(
        and(eq(users.organizationId, organizationId), eq(users.role, roleName as any))
      );
      log(`[ApprovalRouter] role "${roleName}" → ${roleUsers.length} user(s)`);
      return roleUsers.map(u => u.id);
    }

    case "manager": {
      // Find managers in the same org (admin or procurement_manager)
      const managers = await db.select().from(users).where(
        and(
          eq(users.organizationId, organizationId),
          or(eq(users.role, "procurement_manager"), eq(users.role, "admin"))
        )
      );
      return managers.map(m => m.id);
    }

    default:
      return [];
  }
}

/**
 * Create the full approval chain for a purchase request.
 * Returns the number of approval records created.
 */
export async function createApprovalChain(
  organizationId: number,
  requestId: number,
  request: PurchaseRequest
): Promise<{ success: boolean; approvalCount: number }> {
  const db = await getDb();
  if (!db) {
    console.warn("[ApprovalRouter] DB unavailable — skipping approval chain");
    return { success: false, approvalCount: 0 };
  }

  const policy = await findMatchingPolicy(organizationId, request);
  if (!policy) {
    log(`[ApprovalRouter] No policy matched request ${requestId} (amount: ${request.totalAmount}) — auto-approving`);
    return { success: true, approvalCount: 0 };
  }

  const steps = await getApprovalSteps(policy.id);
  if (steps.length === 0) {
    log(`[ApprovalRouter] Policy "${policy.name}" has no steps — auto-approving`);
    return { success: true, approvalCount: 0 };
  }

  let approvalCount = 0;
  for (const step of steps) {
    const approverIds = await resolveApprover(organizationId, step, request.requesterId, request.departmentId);
    // Read SLA from org settings (falls back to 48h if not configured)
    const { getOrgSettings } = await import("./orgSettings");
    const settings = await getOrgSettings(organizationId);
    const slaHours = settings.workflowSettings.slaHours ?? 48;
    const dueAt = new Date(Date.now() + slaHours * 60 * 60 * 1000);
    for (const approverId of approverIds) {
      await db.insert(approvals).values({
        requestId,
        stepOrder: step.stepOrder,
        approverId,
        decision: "pending",
        dueAt,
      });
      approvalCount++;
    }
  }

  log(`[ApprovalRouter] Created ${approvalCount} approval(s) for request ${requestId} via policy "${policy.name}"`);
  return { success: true, approvalCount };
}

/**
 * Check if all approvals on a given step are complete.
 */
export async function canProceedToNextStep(requestId: number, currentStep: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const stepApprovals = await db.select().from(approvals).where(
    and(eq(approvals.requestId, requestId), eq(approvals.stepOrder, currentStep))
  );

  if (stepApprovals.length === 0) return true;
  if (stepApprovals.some(a => a.decision === "rejected")) return false;
  return stepApprovals.every(a => a.decision === "approved");
}

/**
 * Get the current (lowest incomplete) step number for a request.
 */
export async function getCurrentApprovalStep(requestId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 1;

  const allApprovals = await db.select().from(approvals)
    .where(eq(approvals.requestId, requestId))
    .orderBy(approvals.stepOrder);

  if (allApprovals.length === 0) return 1;

  const steps = [...new Set(allApprovals.map(a => a.stepOrder))].sort((a, b) => a - b);
  for (const step of steps) {
    const stepApprovals = allApprovals.filter(a => a.stepOrder === step);
    if (!stepApprovals.every(a => a.decision === "approved")) return step;
  }
  return Math.max(...steps) + 1;
}

/**
 * Recompute and persist the purchase request status based on its approval records.
 */
export async function updateRequestStatus(requestId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const allApprovals = await db.select().from(approvals)
    .where(eq(approvals.requestId, requestId));

  if (allApprovals.length === 0) return;

  const anyRejected = allApprovals.some(a => a.decision === "rejected");
  const allApproved = allApprovals.every(a => a.decision === "approved");

  const newStatus: "pending_approval" | "approved" | "rejected" = anyRejected
    ? "rejected"
    : allApproved ? "approved" : "pending_approval";

  await db.update(purchaseRequests)
    .set({ status: newStatus })
    .where(eq(purchaseRequests.id, requestId));
}
