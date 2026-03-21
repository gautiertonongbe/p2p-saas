import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { createAuditLog } from "../db";

// Risk criteria definitions — weighted scoring
const RISK_CRITERIA = [
  { id: "ifu", label: "IFU / Numéro fiscal", weight: 25, category: "legal", blocking: true, description: "Numéro d'identification fiscale unique vérifié" },
  { id: "rccm", label: "RCCM vérifié", weight: 20, category: "legal", blocking: true, description: "Registre du commerce et crédit mobilier à jour" },
  { id: "rib", label: "RIB / Coordonnées bancaires", weight: 15, category: "financial", blocking: true, description: "Relevé d'identité bancaire vérifié" },
  { id: "insurance", label: "Attestation d'assurance RC", weight: 10, category: "compliance", blocking: false, description: "Assurance responsabilité civile valide" },
  { id: "references", label: "Références clients vérifiées", weight: 10, category: "reputation", blocking: false, description: "Au moins 2 références professionnelles confirmées" },
  { id: "no_litigation", label: "Aucun litige en cours", weight: 10, category: "legal", blocking: false, description: "Pas de procédures judiciaires connues" },
  { id: "financial_capacity", label: "Capacité financière", weight: 5, category: "financial", blocking: false, description: "Chiffre d'affaires ou capacité suffisants pour le marché" },
  { id: "site_visit", label: "Visite du site réalisée", weight: 5, category: "reputation", blocking: false, description: "Locaux professionnels vérifiés physiquement ou par vidéo" },
];

export const vendorRiskRouter = router({
  getCriteria: protectedProcedure.query(() => RISK_CRITERIA),

  getScore: protectedProcedure
    .input(z.object({ vendorId: z.number() }))
    .query(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return null;
      try {
        const rows = await dbInstance.execute(
          `SELECT * FROM vendorRiskScores WHERE vendorId = ${input.vendorId} AND organizationId = ${ctx.user.organizationId} LIMIT 1`
        ) as any;
        const record = (rows[0] || [])[0];
        if (!record) return null;
        const checks = JSON.parse(record.checks || "{}");
        // Compute score
        let score = 0;
        let blockingFailed: string[] = [];
        RISK_CRITERIA.forEach(c => {
          if (checks[c.id]?.passed) score += c.weight;
          if (c.blocking && !checks[c.id]?.passed) blockingFailed.push(c.label);
        });
        const riskLevel = score >= 80 ? "low" : score >= 55 ? "medium" : "high";
        const blocked = blockingFailed.length > 0;
        return { ...record, checks, score, riskLevel, blocked, blockingFailed };
      } catch { return null; }
    }),

  saveScore: protectedProcedure
    .input(z.object({
      vendorId: z.number(),
      checks: z.record(z.string(), z.object({
        passed: z.boolean(),
        notes: z.string().optional(),
        verifiedAt: z.string().optional(),
      })),
      reviewNotes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "procurement_manager") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      let score = 0;
      let blockingFailed: string[] = [];
      RISK_CRITERIA.forEach(c => {
        if (input.checks[c.id]?.passed) score += c.weight;
        if (c.blocking && !input.checks[c.id]?.passed) blockingFailed.push(c.id);
      });
      const riskLevel = score >= 80 ? "low" : score >= 55 ? "medium" : "high";
      const blocked = blockingFailed.length > 0;
      const checksJson = JSON.stringify(input.checks).replace(/'/g, "''");
      const notes = input.reviewNotes ? `'${input.reviewNotes.replace(/'/g, "''")}'` : "NULL";

      await dbInstance.execute(
        `INSERT INTO vendorRiskScores (organizationId, vendorId, score, riskLevel, blocked, checks, reviewNotes, reviewedBy, reviewedAt)
         VALUES (${ctx.user.organizationId}, ${input.vendorId}, ${score}, '${riskLevel}', ${blocked ? 1 : 0}, '${checksJson}', ${notes}, ${ctx.user.id}, NOW())
         ON DUPLICATE KEY UPDATE score=${score}, riskLevel='${riskLevel}', blocked=${blocked ? 1 : 0}, checks='${checksJson}', reviewNotes=${notes}, reviewedBy=${ctx.user.id}, reviewedAt=NOW()`
      );

      // Update vendor performance score
      await dbInstance.execute(
        `UPDATE vendors SET performanceScore = ${score} WHERE id = ${input.vendorId} AND organizationId = ${ctx.user.organizationId}`
      );

      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "vendor",
        entityId: input.vendorId,
        action: "risk_scored",
        actorId: ctx.user.id,
        newValue: { score, riskLevel, blocked },
      });

      return { score, riskLevel, blocked, blockingFailed };
    }),

  listHighRisk: protectedProcedure.query(async ({ ctx }) => {
    const dbInstance = await db.getDb();
    if (!dbInstance) return [];
    try {
      const rows = await dbInstance.execute(
        `SELECT vrs.*, v.legalName FROM vendorRiskScores vrs
         LEFT JOIN vendors v ON vrs.vendorId = v.id
         WHERE vrs.organizationId = ${ctx.user.organizationId}
         AND (vrs.riskLevel = 'high' OR vrs.blocked = 1)
         ORDER BY vrs.score ASC`
      ) as any;
      return (rows[0] || []) as any[];
    } catch { return []; }
  }),

  checkVendorForPO: protectedProcedure
    .input(z.object({ vendorId: z.number() }))
    .query(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return { allowed: true, score: null, riskLevel: null, blocked: false, message: null };
      try {
        const rows = await dbInstance.execute(
          `SELECT * FROM vendorRiskScores WHERE vendorId = ${input.vendorId} AND organizationId = ${ctx.user.organizationId} LIMIT 1`
        ) as any;
        const record = (rows[0] || [])[0];
        if (!record) return { allowed: true, score: null, riskLevel: null, blocked: false, message: "Fournisseur non évalué — évaluation recommandée avant commande" };
        if (record.blocked) return { allowed: false, score: record.score, riskLevel: record.riskLevel, blocked: true, message: "Fournisseur bloqué — documents obligatoires manquants (IFU, RCCM ou RIB)" };
        if (record.riskLevel === "high") return { allowed: true, score: record.score, riskLevel: "high", blocked: false, message: "⚠️ Fournisseur à risque élevé — procédez avec précaution" };
        return { allowed: true, score: record.score, riskLevel: record.riskLevel, blocked: false, message: null };
      } catch { return { allowed: true, score: null, riskLevel: null, blocked: false, message: null }; }
    }),
});
