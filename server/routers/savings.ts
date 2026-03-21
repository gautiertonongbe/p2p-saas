import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { createAuditLog } from "../db";

export const savingsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const dbInstance = await db.getDb();
    if (!dbInstance) return [];
    try {
      const rows = await dbInstance.execute(
        `SELECT s.*, v.legalName as vendorName, u.name as recordedByName
         FROM savingsRecords s
         LEFT JOIN vendors v ON s.vendorId = v.id
         LEFT JOIN users u ON s.recordedBy = u.id
         WHERE s.organizationId = ${ctx.user.organizationId}
         ORDER BY s.createdAt DESC`
      ) as any;
      return (rows[0] || []) as any[];
    } catch { return []; }
  }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(2),
      vendorId: z.number().optional(),
      savingsType: z.enum(["price_negotiation","volume_discount","alternative_vendor","process_improvement","contract_renegotiation","other"]),
      budgetAmount: z.number().positive(),
      actualAmount: z.number().positive(),
      category: z.string().optional(),
      departmentId: z.number().optional(),
      poId: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "procurement_manager") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const savingsAmount = input.budgetAmount - input.actualAmount;
      const savingsPct = ((savingsAmount / input.budgetAmount) * 100).toFixed(2);
      await dbInstance.execute(
        `INSERT INTO savingsRecords (organizationId, title, vendorId, savingsType, budgetAmount, actualAmount, savingsAmount, savingsPercent, category, departmentId, poId, notes, recordedBy)
         VALUES (${ctx.user.organizationId}, '${input.title.replace(/'/g, "''")}', ${input.vendorId || "NULL"}, '${input.savingsType}', ${input.budgetAmount}, ${input.actualAmount}, ${savingsAmount}, ${savingsPct}, ${input.category ? `'${input.category}'` : "NULL"}, ${input.departmentId || "NULL"}, ${input.poId || "NULL"}, ${input.notes ? `'${input.notes.replace(/'/g, "''")}'` : "NULL"}, ${ctx.user.id})`
      );
      return { success: true, savingsAmount, savingsPercent: parseFloat(savingsPct) };
    }),

  getStats: protectedProcedure
    .input(z.object({ year: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return { totalSavings: 0, savingsCount: 0, avgSavingsPct: 0, byType: [], byMonth: [] };
      const year = input?.year || new Date().getFullYear();
      try {
        const [summary, byType, byMonth] = await Promise.all([
          dbInstance.execute(
            `SELECT SUM(savingsAmount) as totalSavings, COUNT(*) as savingsCount, AVG(savingsPercent) as avgSavingsPct FROM savingsRecords WHERE organizationId = ${ctx.user.organizationId} AND YEAR(createdAt) = ${year}`
          ) as any,
          dbInstance.execute(
            `SELECT savingsType, SUM(savingsAmount) as total, COUNT(*) as count FROM savingsRecords WHERE organizationId = ${ctx.user.organizationId} AND YEAR(createdAt) = ${year} GROUP BY savingsType ORDER BY total DESC`
          ) as any,
          dbInstance.execute(
            `SELECT MONTH(createdAt) as month, SUM(savingsAmount) as total FROM savingsRecords WHERE organizationId = ${ctx.user.organizationId} AND YEAR(createdAt) = ${year} GROUP BY MONTH(createdAt) ORDER BY month`
          ) as any,
        ]);
        return {
          ...(summary[0]?.[0] || { totalSavings: 0, savingsCount: 0, avgSavingsPct: 0 }),
          byType: byType[0] || [],
          byMonth: byMonth[0] || [],
        };
      } catch { return { totalSavings: 0, savingsCount: 0, avgSavingsPct: 0, byType: [], byMonth: [] }; }
    }),
});
