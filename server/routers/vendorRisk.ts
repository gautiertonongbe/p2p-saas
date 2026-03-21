import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { createAuditLog } from "../db";

// Risk criteria definitions — weighted scoring
// West Africa procurement risk criteria
// Based on CIPS framework, ISO 20400, and OHADA legal requirements (Benin/Côte d'Ivoire)
// Blocking = must pass for vendor to be usable on any PO
// Total weight = 100
const RISK_CRITERIA = [
  // ── LEGAL IDENTITY (45 pts) ───────────────────────────────────────────────
  { id: "ifu", label: "IFU / Numéro fiscal vérifié", weight: 20, category: "legal", blocking: true,
    description: "Numéro d'identification fiscale unique — vérifier sur le portail fiscal national" },
  { id: "rccm", label: "RCCM en cours de validité", weight: 15, category: "legal", blocking: true,
    description: "Registre du commerce à jour — vérifier la date d'expiration (renouvellement annuel)" },
  { id: "conflict_of_interest", label: "Déclaration d'absence de conflit d'intérêt", weight: 10, category: "legal", blocking: true,
    description: "Document signé attestant l'absence de lien avec les décisionnaires de l'organisation" },

  // ── CAPACITÉ FINANCIÈRE (25 pts) ──────────────────────────────────────────
  { id: "rib", label: "RIB / Coordonnées bancaires vérifiées", weight: 15, category: "financial", blocking: true,
    description: "Appel téléphonique de confirmation avec la banque ou virement test de 1 XOF" },
  { id: "financial_capacity", label: "Capacité financière suffisante", weight: 10, category: "financial", blocking: false,
    description: "Chiffre d'affaires annuel ≥ 2× la valeur du marché envisagé. Demander les derniers états financiers." },

  // ── CONFORMITÉ RÉGLEMENTAIRE (20 pts) ─────────────────────────────────────
  { id: "insurance", label: "Assurance RC professionnelle valide", weight: 10, category: "compliance", blocking: false,
    description: "Attestation d'assurance responsabilité civile — vérifier la date d'expiration" },
  { id: "tax_compliance", label: "Attestation de régularité fiscale", weight: 10, category: "compliance", blocking: false,
    description: "Quitus fiscal ou attestation DGI de moins de 3 mois attestant l'absence de dette fiscale" },

  // ── RÉPUTATION & RÉFÉRENCES (10 pts) ──────────────────────────────────────
  { id: "references", label: "Références clients confirmées", weight: 5, category: "reputation", blocking: false,
    description: "Au moins 2 références d'organisations similaires contactées et validées" },
  { id: "no_litigation", label: "Absence de litige ou procédure judiciaire", weight: 5, category: "reputation", blocking: false,
    description: "Recherche dans les registres publics et presse locale — demander une déclaration sur l'honneur" },
];

// Risk thresholds (industry standard: CIPS Supplier Risk Framework)
// < 60  = High risk   → alert on PO, recommend secondary approval
// 60-79 = Medium risk → allowed with warning
// ≥ 80  = Low risk    → approved, no restrictions
// Blocked = any blocking criterion failed → cannot be used regardless of score

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
        const riskLevel = score >= 80 ? "low" : score >= 60 ? "medium" : "high";
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
      const riskLevel = score >= 80 ? "low" : score >= 60 ? "medium" : "high";
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
        if (record.riskLevel === "high") return { allowed: true, score: record.score, riskLevel: "high", blocked: false, message: "⚠️ Risque élevé (score < 60) — recommandez une approbation supplémentaire" };
        if (record.riskLevel === "medium") return { allowed: true, score: record.score, riskLevel: "medium", blocked: false, message: "Risque modéré — vérifiez les critères manquants avant paiement" };
        return { allowed: true, score: record.score, riskLevel: record.riskLevel, blocked: false, message: null };
      } catch { return { allowed: true, score: null, riskLevel: null, blocked: false, message: null }; }
    }),
});
