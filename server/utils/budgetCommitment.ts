/**
 * Budget Commitment Engine
 * 
 * Automatically commits budget when a PR is approved,
 * releases commitment when rejected/cancelled,
 * and moves committed → actual when invoice is paid.
 */

import { getDb } from "../db";
import { budgets, purchaseRequests } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

const CURRENT_PERIOD = () => {
  const now = new Date();
  const y = now.getFullYear();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return `${y}-Q${q}`;
};

/**
 * Find the budget that covers a given department for the current period.
 * Tries exact period match first, then current quarter.
 */
async function findBudget(organizationId: number, departmentId: number) {
  const db = await getDb();
  if (!db) return null;

  const period = CURRENT_PERIOD();
  const results = await db.select().from(budgets)
    .where(and(
      eq(budgets.organizationId, organizationId),
      eq(budgets.scopeType, "department"),
      eq(budgets.scopeId, departmentId),
      eq(budgets.fiscalPeriod, period)
    ))
    .limit(1);

  return results[0] ?? null;
}

/**
 * Commit an amount against a department budget (on PR approval).
 */
export async function commitBudget(
  organizationId: number,
  departmentId: number | null,
  amount: number
): Promise<void> {
  if (!departmentId || amount <= 0) return;
  const db = await getDb();
  if (!db) return;

  const budget = await findBudget(organizationId, departmentId);
  if (!budget) return;

  const current = parseFloat(budget.committedAmount ?? "0");
  await db.update(budgets)
    .set({ committedAmount: (current + amount).toFixed(2) })
    .where(eq(budgets.id, budget.id));
}

/**
 * Release a committed amount (on PR rejection/cancellation).
 */
export async function releaseBudgetCommitment(
  organizationId: number,
  departmentId: number | null,
  amount: number
): Promise<void> {
  if (!departmentId || amount <= 0) return;
  const db = await getDb();
  if (!db) return;

  const budget = await findBudget(organizationId, departmentId);
  if (!budget) return;

  const current = parseFloat(budget.committedAmount ?? "0");
  const newCommitted = Math.max(0, current - amount);
  await db.update(budgets)
    .set({ committedAmount: newCommitted.toFixed(2) })
    .where(eq(budgets.id, budget.id));
}

/**
 * Move amount from committed → actual (when invoice is paid).
 */
export async function actualizeBudget(
  organizationId: number,
  departmentId: number | null,
  amount: number
): Promise<void> {
  if (!departmentId || amount <= 0) return;
  const db = await getDb();
  if (!db) return;

  const budget = await findBudget(organizationId, departmentId);
  if (!budget) return;

  const committed = parseFloat(budget.committedAmount ?? "0");
  const actual = parseFloat(budget.actualAmount ?? "0");

  await db.update(budgets)
    .set({
      committedAmount: Math.max(0, committed - amount).toFixed(2),
      actualAmount: (actual + amount).toFixed(2),
    })
    .where(eq(budgets.id, budget.id));
}
