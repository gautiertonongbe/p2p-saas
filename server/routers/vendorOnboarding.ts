import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { db } from "../db";

export const vendorOnboardingRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const dbInstance = await db.getDb();
    if (!dbInstance) return [];
    try {
      const rows = await dbInstance.execute(
        `SELECT vo.*, v.legalName as vendorName FROM vendorOnboarding vo LEFT JOIN vendors v ON vo.vendorId = v.id WHERE vo.organizationId = ${ctx.user.organizationId} ORDER BY vo.createdAt DESC`
      ) as any;
      return (rows[0] || []) as any[];
    } catch { return []; }
  }),

  start: protectedProcedure
    .input(z.object({ vendorId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "procurement_manager") throw new TRPCError({ code: "FORBIDDEN" });
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const checklist = JSON.stringify([
        { id: "ifu", label: "IFU / Numéro fiscal", required: true, done: false },
        { id: "rccm", label: "RCCM (Registre du commerce)", required: true, done: false },
        { id: "rib", label: "Relevé d'identité bancaire (RIB)", required: true, done: false },
        { id: "insurance", label: "Attestation d'assurance", required: false, done: false },
        { id: "references", label: "3 références clients", required: false, done: false },
        { id: "financial", label: "États financiers dernière année", required: false, done: false },
        { id: "compliance", label: "Déclaration de non-conflit d'intérêt", required: true, done: false },
        { id: "bank_verified", label: "Coordonnées bancaires vérifiées", required: true, done: false },
      ]);
      await dbInstance.execute(
        `INSERT INTO vendorOnboarding (organizationId, vendorId, status, currentStep, checklist, riskScore, createdBy) VALUES (${ctx.user.organizationId}, ${input.vendorId}, 'in_progress', 1, '${checklist}', 0, ${ctx.user.id}) ON DUPLICATE KEY UPDATE status='in_progress', currentStep=1`
      );
      return { success: true };
    }),

  updateChecklist: protectedProcedure
    .input(z.object({
      vendorId: z.number(),
      checklistItemId: z.string(),
      done: z.boolean(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "procurement_manager") throw new TRPCError({ code: "FORBIDDEN" });
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await dbInstance.execute(`SELECT checklist FROM vendorOnboarding WHERE vendorId = ${input.vendorId} AND organizationId = ${ctx.user.organizationId} LIMIT 1`) as any;
      const record = (rows[0] || [])[0];
      if (!record) throw new TRPCError({ code: "NOT_FOUND" });
      const checklist = JSON.parse(record.checklist);
      const item = checklist.find((c: any) => c.id === input.checklistItemId);
      if (item) { item.done = input.done; if (input.notes) item.notes = input.notes; }
      const completedRequired = checklist.filter((c: any) => c.required && c.done).length;
      const totalRequired = checklist.filter((c: any) => c.required).length;
      const riskScore = Math.round((completedRequired / totalRequired) * 100);
      const completed = checklist.every((c: any) => !c.required || c.done);
      await dbInstance.execute(
        `UPDATE vendorOnboarding SET checklist = '${JSON.stringify(checklist).replace(/'/g, "''")}', riskScore = ${riskScore}, status = '${completed ? "completed" : "in_progress"}' WHERE vendorId = ${input.vendorId} AND organizationId = ${ctx.user.organizationId}`
      );
      return { riskScore, completed };
    }),

  approve: protectedProcedure
    .input(z.object({ vendorId: z.number(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await dbInstance.execute(`UPDATE vendorOnboarding SET status = 'approved', approvedBy = ${ctx.user.id}, approvedAt = NOW() WHERE vendorId = ${input.vendorId} AND organizationId = ${ctx.user.organizationId}`);
      await dbInstance.execute(`UPDATE vendors SET status = 'active' WHERE id = ${input.vendorId} AND organizationId = ${ctx.user.organizationId}`);
      return { success: true };
    }),

  getByVendor: protectedProcedure
    .input(z.object({ vendorId: z.number() }))
    .query(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return null;
      try {
        const rows = await dbInstance.execute(`SELECT * FROM vendorOnboarding WHERE vendorId = ${input.vendorId} AND organizationId = ${ctx.user.organizationId} LIMIT 1`) as any;
        const record = (rows[0] || [])[0];
        if (!record) return null;
        return { ...record, checklist: JSON.parse(record.checklist) };
      } catch { return null; }
    }),
});
