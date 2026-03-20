import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { TRPCError } from "@trpc/server";
import { createAuditLog } from "../db";

function safe(s: string | null | undefined): string {
  if (s === null || s === undefined) return "NULL";
  return String(s).replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, (ch: string) => {
    const map: Record<string, string> = {"\0":"\\0","\x08":"\\b","\x09":"\\t","\x1a":"\\z","\n":"\\n","\r":"\\r",'"':'\\"',"'":"\\'",'\\':"\\\\",'%':"\\%"};
    return map[ch] || ch;
  });
}
function esc(s: string | null | undefined): string {
  if (s === null || s === undefined) return "NULL";
  return `'${safe(s)}'`;
}

export const expensesRouter = router({
  // List expense reports
  list: protectedProcedure
    .input(z.object({ status: z.string().optional(), myOnly: z.boolean().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const where = [`er.organizationId = ${ctx.user.organizationId}`];
      if (input?.status) where.push(`er.status = '${input.status}'`);
      if (input?.myOnly) where.push(`er.submitterId = ${ctx.user.id}`);
      const result = await db.execute(`
        SELECT er.*, u.name as submitterName, u.email as submitterEmail,
          a.name as approverName
        FROM expenseReports er
        JOIN users u ON er.submitterId = u.id
        LEFT JOIN users a ON er.approvedBy = a.id
        WHERE ${where.join(" AND ")}
        ORDER BY er.createdAt DESC
        LIMIT 200
      `);
      return (result as any)[0] || [];
    }),

  // Get single report with lines
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [rResult, lResult] = await Promise.all([
        db.execute(`
          SELECT er.*, u.name as submitterName, u.email as submitterEmail,
            a.name as approverName
          FROM expenseReports er
          JOIN users u ON er.submitterId = u.id
          LEFT JOIN users a ON er.approvedBy = a.id
          WHERE er.id = ${input.id} AND er.organizationId = ${ctx.user.organizationId}
          LIMIT 1
        `),
        db.execute(`SELECT * FROM expenseLines WHERE reportId = ${input.id} ORDER BY expenseDate ASC`)
      ]);
      const report = (rResult as any)[0]?.[0];
      if (!report) throw new TRPCError({ code: "NOT_FOUND" });
      return { ...report, lines: (lResult as any)[0] || [] };
    }),

  // Create expense report
  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      periodStart: z.string().optional(),
      periodEnd: z.string().optional(),
      lines: z.array(z.object({
        expenseDate: z.string(),
        category: z.string(),
        description: z.string().optional(),
        amount: z.number().positive(),
        vendorName: z.string().optional(),
        isBillable: z.boolean().optional(),
        projectId: z.number().optional(),
        glAccountId: z.number().optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Generate report number
      const year = new Date().getFullYear();
      const countRes = await db.execute(`SELECT COUNT(*) as c FROM expenseReports WHERE organizationId = ${ctx.user.organizationId} AND YEAR(createdAt) = ${year}`);
      const count = Number((countRes as any)[0]?.[0]?.c || 0) + 1;
      const reportNumber = `NDF-${year}-${String(count).padStart(4, "0")}`;

      const totalAmount = input.lines.reduce((s, l) => s + l.amount, 0);

      await db.execute(`
        INSERT INTO expenseReports (organizationId, reportNumber, submitterId, title, description, status, totalAmount, periodStart, periodEnd)
        VALUES (${ctx.user.organizationId}, '${reportNumber}', ${ctx.user.id}, 
          '${safe(input.title)}', 
          ${input.description ? `'${safe(input.description)}'` : "NULL"},
          'draft', ${totalAmount},
          ${input.periodStart ? `'${input.periodStart}'` : "NULL"},
          ${input.periodEnd ? `'${input.periodEnd}'` : "NULL"}
        )
      `);

      const idRes = await db.execute(`SELECT LAST_INSERT_ID() as id`);
      const reportId = (idRes as any)[0]?.[0]?.id;

      for (const line of input.lines) {
        await db.execute(`
          INSERT INTO expenseLines (reportId, expenseDate, category, description, amount, vendorName, isBillable, projectId, glAccountId)
          VALUES (${reportId}, '${line.expenseDate}', '${safe(line.category)}',
            ${line.description ? `'${safe(line.description)}'` : "NULL"},
            ${line.amount},
            ${line.vendorName ? `'${safe(line.vendorName)}'` : "NULL"},
            ${line.isBillable ? 1 : 0},
            ${line.projectId || "NULL"},
            ${line.glAccountId || "NULL"}
          )
        `);
      }

      return { id: reportId, reportNumber };
    }),

  // Submit for approval
  submit: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.execute(`
        UPDATE expenseReports SET status = 'submitted'
        WHERE id = ${input.id} AND submitterId = ${ctx.user.id} AND status = 'draft'
      `);
      return { success: true };
    }),

  // Approve
  approve: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!["admin", "procurement_manager", "approver"].includes(ctx.user.role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.execute(`
        UPDATE expenseReports SET status = 'approved', approvedBy = ${ctx.user.id}, approvedAt = NOW()
        WHERE id = ${input.id} AND organizationId = ${ctx.user.organizationId} AND status = 'submitted'
      `);
      return { success: true };
    }),

  // Reject
  reject: protectedProcedure
    .input(z.object({ id: z.number(), reason: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (!["admin", "procurement_manager", "approver"].includes(ctx.user.role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.execute(`
        UPDATE expenseReports SET status = 'rejected', rejectionReason = '${safe(input.reason)}'
        WHERE id = ${input.id} AND organizationId = ${ctx.user.organizationId}
      `);
      return { success: true };
    }),

  // Mark reimbursed
  markReimbursed: protectedProcedure
    .input(z.object({
      id: z.number(),
      method: z.enum(["bank_transfer", "mobile_money", "cash"]),
      reference: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!["admin", "procurement_manager"].includes(ctx.user.role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.execute(`
        UPDATE expenseReports 
        SET status = 'reimbursed', reimbursedAt = NOW(),
            reimbursementMethod = '${input.method}',
            reimbursementRef = ${input.reference ? `'${safe(input.reference)}'` : "NULL"}
        WHERE id = ${input.id} AND organizationId = ${ctx.user.organizationId} AND status = 'approved'
      `);
      return { success: true };
    }),

  // Delete draft
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.execute(`DELETE FROM expenseLines WHERE reportId = ${input.id}`);
      await db.execute(`DELETE FROM expenseReports WHERE id = ${input.id} AND submitterId = ${ctx.user.id} AND organizationId = ${ctx.user.organizationId} AND status = 'draft'`);
      return { success: true };
    }),

  // Summary stats
  stats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return {};
    const result = await db.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
        SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) as submitted,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'reimbursed' THEN 1 ELSE 0 END) as reimbursed,
        SUM(CASE WHEN status = 'reimbursed' THEN totalAmount ELSE 0 END) as totalReimbursed,
        SUM(CASE WHEN status IN ('submitted','approved') THEN totalAmount ELSE 0 END) as pendingAmount
      FROM expenseReports
      WHERE organizationId = ${ctx.user.organizationId} AND submitterId = ${ctx.user.id}
    `);
    return (result as any)[0]?.[0] || {};
  }),
});
