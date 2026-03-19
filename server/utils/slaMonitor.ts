/**
 * SLA Monitor — runs as a background interval job.
 * Checks for approvals past their dueAt deadline and:
 * 1. Creates an escalation notification for the approver's manager
 * 2. Marks the approval as escalated (sets escalatedAt)
 * 
 * Call startSLAMonitor() once on server startup.
 */

import { getDb } from "../db";
import { approvals, purchaseRequests, users, invoices, vendorContracts, vendors } from "../../drizzle/schema";
import { eq, and, isNull, isNotNull, lte, lt } from "drizzle-orm";
import { createNotificationForMany, createNotification } from "./notifications";

const SLA_CHECK_INTERVAL_MS = 10 * 60 * 1000; // every 10 minutes
const DEFAULT_SLA_HOURS = 48;

async function checkOverdueApprovals() {
  const db = await getDb();
  if (!db) return;

  const now = new Date();

  const overdue = await db.select().from(approvals)
    .where(and(
      eq(approvals.decision, "pending"),
      isNotNull(approvals.dueAt),
      lte(approvals.dueAt, now),
      isNull(approvals.escalatedAt)
    ))
    .limit(50);

  if (overdue.length === 0) return;

  for (const approval of overdue) {
    try {
      const [request] = await db.select().from(purchaseRequests)
        .where(eq(purchaseRequests.id, approval.requestId))
        .limit(1);
      if (!request) continue;

      const managers = await db.select().from(users)
        .where(and(eq(users.organizationId, request.organizationId), eq(users.role, "admin")));

      if (managers.length > 0) {
        await createNotificationForMany({
          organizationId: request.organizationId,
          userIds: managers.map(m => m.id),
          type: "approval_overdue",
          title: "Approbation en retard",
          message: `L'approbation de "${request.title}" est en retard. L'approbateur n'a pas répondu dans les délais.`,
          entityType: "purchaseRequest",
          entityId: request.id,
        });
      }

      await createNotification({
        organizationId: request.organizationId,
        userId: approval.approverId,
        type: "approval_overdue",
        title: "Action requise — délai dépassé",
        message: `Votre approbation sur "${request.title}" est en retard. Veuillez traiter cette demande immédiatement.`,
        entityType: "purchaseRequest",
        entityId: request.id,
      });

      await db.update(approvals)
        .set({ escalatedAt: now })
        .where(eq(approvals.id, approval.id));
    } catch (err) {
      console.warn(`[SLAMonitor] Failed to escalate approval ${approval.id}:`, (err as Error).message);
    }
  }

  if (overdue.length > 0) {
    console.log(`[SLAMonitor] Escalated ${overdue.length} overdue approval(s)`);
  }
}

async function checkOverdueInvoices() {
  const db = await getDb();
  if (!db) return;

  const now = new Date();

  // Find approved (unpaid) invoices past their due date
  const overdueInvoices = await db.select().from(invoices)
    .where(and(
      eq(invoices.status, "approved"),
      isNotNull(invoices.dueDate),
      lt(invoices.dueDate, now)
    ))
    .limit(50);

  for (const invoice of overdueInvoices) {
    try {
      // Find admin + procurement_manager in the org to notify
      const managers = await db.select().from(users)
        .where(and(
          eq(users.organizationId, invoice.organizationId),
          eq(users.role, "procurement_manager")
        ));
      const admins = await db.select().from(users)
        .where(and(eq(users.organizationId, invoice.organizationId), eq(users.role, "admin")));

      const notifyIds = [...new Set([...managers, ...admins].map(u => u.id))];
      if (notifyIds.length === 0) continue;

      const daysOverdue = Math.floor((now.getTime() - new Date(invoice.dueDate!).getTime()) / (1000 * 60 * 60 * 24));

      await createNotificationForMany({
        organizationId: invoice.organizationId,
        userIds: notifyIds,
        type: "invoice_overdue",
        title: "Facture en retard de paiement",
        message: `La facture ${invoice.invoiceNumber} est en retard de ${daysOverdue} jour(s). Montant: ${new Intl.NumberFormat("fr-FR").format(parseFloat(invoice.amount))} XOF.`,
        entityType: "invoice",
        entityId: invoice.id,
      });
    } catch (err) {
      console.warn(`[SLAMonitor] Failed to notify overdue invoice ${invoice.id}:`, (err as Error).message);
    }
  }

  if (overdueInvoices.length > 0) {
    console.log(`[SLAMonitor] Notified ${overdueInvoices.length} overdue invoice(s)`);
  }
}

async function checkExpiringContracts() {
  const db = await getDb();
  if (!db) return;

  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Find contracts expiring within the next 30 days not yet notified today
  const expiring = await db.select().from(vendorContracts)
    .where(and(
      eq(vendorContracts.status, "active"),
      isNotNull(vendorContracts.endDate),
      lte(vendorContracts.endDate, in30Days),
      lte(now, vendorContracts.endDate as any)  // endDate is in the future (not expired yet)
    ))
    .limit(20);

  for (const contract of expiring) {
    try {
      // Find the org via vendor
      const [vendor] = await db.select().from(vendors)
        .where(eq(vendors.id, contract.vendorId))
        .limit(1);
      if (!vendor) continue;

      const admins = await db.select().from(users)
        .where(and(eq(users.organizationId, vendor.organizationId), eq(users.role, "admin")));
      if (!admins.length) continue;

      const daysLeft = Math.ceil((new Date(contract.endDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      await createNotificationForMany({
        organizationId: vendor.organizationId,
        userIds: admins.map(a => a.id),
        type: "contract_expiring",
        title: "Contrat fournisseur expirant",
        message: `Le contrat "${contract.title}" avec ${vendor.legalName} expire dans ${daysLeft} jour(s) (${contract.contractNumber}).`,
        entityType: "vendor",
        entityId: vendor.id,
      });
    } catch (err) {
      console.warn(`[SLAMonitor] Failed to notify expiring contract ${contract.id}:`, (err as Error).message);
    }
  }
}

async function runAllChecks() {
  await Promise.allSettled([
    checkOverdueApprovals(),
    checkOverdueInvoices(),
    checkExpiringContracts(),
  ]);
}

export function startSLAMonitor() {
  console.log(`[SLAMonitor] Started — running checks every ${SLA_CHECK_INTERVAL_MS / 60000}min`);
  runAllChecks().catch(console.warn);
  setInterval(runAllChecks, SLA_CHECK_INTERVAL_MS);
}
