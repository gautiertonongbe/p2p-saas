/**
 * Archiving & Retention Router
 *
 * Policy:
 *   - PRs / POs / Invoices completed > 2 years → archivable (soft)
 *   - Audit logs → retained 7 years (legal requirement OHADA)
 *   - Notifications → auto-deleted after 90 days
 *   - Archived documents → read-only, excluded from default lists
 *
 * Archive = set isArchived = true, NOT a hard delete.
 * Hard delete is never allowed for financial documents.
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { TRPCError } from "@trpc/server";
import { createAuditLog } from "../db";

// Retention periods in days
export const RETENTION_POLICY = {
  AUDIT_LOGS_DAYS:        365 * 7,  // 7 years — OHADA legal requirement
  NOTIFICATIONS_DAYS:     90,        // 3 months
  COMPLETED_DOCS_ARCHIVE: 365 * 2,  // Archive after 2 years
  ARCHIVED_DOCS_DELETE:   365 * 10, // Hard delete after 10 years (optional)
};

export const archivingRouter = router({

  // ── Get archiving stats ──────────────────────────────────────────────────
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const dbInstance = await db.getDb();
    if (!dbInstance) return null;
    if (ctx.user.role !== "admin" && ctx.user.role !== "procurement_manager") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const orgId = ctx.user.organizationId;
    const cutoff2yr = new Date(Date.now() - RETENTION_POLICY.COMPLETED_DOCS_ARCHIVE * 86400000)
      .toISOString().slice(0, 10);

    try {
      const [prCount]  = await dbInstance.execute(
        `SELECT COUNT(*) as cnt FROM purchaseRequests
         WHERE organizationId=${orgId} AND status IN ('approved','cancelled')
           AND updatedAt < '${cutoff2yr}' AND (isArchived IS NULL OR isArchived=0)`
      ) as any;
      const [invCount] = await dbInstance.execute(
        `SELECT COUNT(*) as cnt FROM invoices
         WHERE organizationId=${orgId} AND status IN ('paid','cancelled')
           AND updatedAt < '${cutoff2yr}' AND (isArchived IS NULL OR isArchived=0)`
      ) as any;
      const [logCount] = await dbInstance.execute(
        `SELECT COUNT(*) as cnt FROM auditLogs WHERE organizationId=${orgId}`
      ) as any;
      const [notifOld] = await dbInstance.execute(
        `SELECT COUNT(*) as cnt FROM notifications
         WHERE userId IN (SELECT id FROM users WHERE organizationId=${orgId})
           AND createdAt < DATE_SUB(NOW(), INTERVAL ${RETENTION_POLICY.NOTIFICATIONS_DAYS} DAY)`
      ) as any;

      return {
        archivablePRs:          Number(prCount[0]?.[0]?.cnt ?? 0),
        archivableInvoices:     Number(invCount[0]?.[0]?.cnt ?? 0),
        totalAuditLogs:         Number(logCount[0]?.[0]?.cnt ?? 0),
        expiredNotifications:   Number(notifOld[0]?.[0]?.cnt ?? 0),
        policy: RETENTION_POLICY,
        cutoffDate: cutoff2yr,
      };
    } catch (e) {
      console.error("archiving.getStats error:", e);
      return null;
    }
  }),

  // ── Archive old completed documents ─────────────────────────────────────
  archiveCompleted: protectedProcedure
    .input(z.object({
      entityType: z.enum(["purchaseRequests", "invoices", "all"]),
      dryRun: z.boolean().default(true), // preview before executing
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const orgId = ctx.user.organizationId;
      const cutoff = new Date(Date.now() - RETENTION_POLICY.COMPLETED_DOCS_ARCHIVE * 86400000)
        .toISOString().slice(0, 10);

      let archived = 0;

      if (!input.dryRun) {
        if (input.entityType === "purchaseRequests" || input.entityType === "all") {
          const r = await dbInstance.execute(
            `UPDATE purchaseRequests SET isArchived=1
             WHERE organizationId=${orgId} AND status IN ('approved','cancelled')
               AND updatedAt < '${cutoff}' AND (isArchived IS NULL OR isArchived=0)`
          ) as any;
          archived += Number(r[0]?.affectedRows ?? 0);
        }
        if (input.entityType === "invoices" || input.entityType === "all") {
          const r = await dbInstance.execute(
            `UPDATE invoices SET isArchived=1
             WHERE organizationId=${orgId} AND status IN ('paid','cancelled')
               AND updatedAt < '${cutoff}' AND (isArchived IS NULL OR isArchived=0)`
          ) as any;
          archived += Number(r[0]?.affectedRows ?? 0);
        }

        await createAuditLog({
          organizationId: orgId,
          entityType: "system",
          entityId: 0,
          action: "archive_completed",
          actorId: ctx.user.id,
          newValue: { entityType: input.entityType, archivedCount: archived, cutoffDate: cutoff },
        });
      }

      return {
        dryRun: input.dryRun,
        cutoffDate: cutoff,
        wouldArchive: archived,
        message: input.dryRun
          ? `Simulation : ${archived} document(s) seraient archivés (antérieurs au ${cutoff})`
          : `${archived} document(s) archivés avec succès`,
      };
    }),

  // ── Purge expired notifications ──────────────────────────────────────────
  purgeExpiredNotifications: protectedProcedure
    .input(z.object({ dryRun: z.boolean().default(true) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const orgId = ctx.user.organizationId;
      const days = RETENTION_POLICY.NOTIFICATIONS_DAYS;

      // Count first
      const [cnt] = await dbInstance.execute(
        `SELECT COUNT(*) as c FROM notifications
         WHERE userId IN (SELECT id FROM users WHERE organizationId=${orgId})
           AND createdAt < DATE_SUB(NOW(), INTERVAL ${days} DAY)`
      ) as any;
      const count = Number(cnt[0]?.[0]?.c ?? 0);

      if (!input.dryRun && count > 0) {
        await dbInstance.execute(
          `DELETE FROM notifications
           WHERE userId IN (SELECT id FROM users WHERE organizationId=${orgId})
             AND createdAt < DATE_SUB(NOW(), INTERVAL ${days} DAY)`
        );
        await createAuditLog({
          organizationId: orgId, entityType: "system", entityId: 0,
          action: "purge_notifications", actorId: ctx.user.id,
          newValue: { purgedCount: count, olderThanDays: days },
        });
      }

      return {
        dryRun: input.dryRun,
        count,
        message: input.dryRun
          ? `Simulation : ${count} notification(s) expirée(s) seraient supprimées`
          : `${count} notification(s) expirée(s) supprimées`,
      };
    }),

  // ── Get retention policy ─────────────────────────────────────────────────
  getPolicy: protectedProcedure.query(() => ({
    ...RETENTION_POLICY,
    description: {
      AUDIT_LOGS_DAYS:        "Journaux d'audit conservés 7 ans (obligation légale OHADA)",
      NOTIFICATIONS_DAYS:     "Notifications auto-supprimées après 90 jours",
      COMPLETED_DOCS_ARCHIVE: "Documents complétés archivés après 2 ans",
      ARCHIVED_DOCS_DELETE:   "Documents archivés définitivement supprimés après 10 ans",
    }
  })),
});
