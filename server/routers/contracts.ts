import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { db } from "../db";
import { createAuditLog } from "../utils/auditLog";

export const contractsRouter = router({
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["active","expired","expiring_soon","draft","terminated"]).optional(),
      vendorId: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return [];
      try {
        const rows = await dbInstance.execute(
          `SELECT c.*, v.legalName as vendorName 
           FROM contracts c 
           LEFT JOIN vendors v ON c.vendorId = v.id 
           WHERE c.organizationId = ${ctx.user.organizationId}
           ${input?.vendorId ? `AND c.vendorId = ${input.vendorId}` : ""}
           ORDER BY c.endDate ASC`
        ) as any;
        const contracts = (rows[0] || []) as any[];
        const now = new Date();
        const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        return contracts.map((c: any) => ({
          ...c,
          computedStatus: c.status === "terminated" ? "terminated"
            : c.status === "draft" ? "draft"
            : new Date(c.endDate) < now ? "expired"
            : new Date(c.endDate) < soon ? "expiring_soon"
            : "active",
          daysUntilExpiry: Math.ceil((new Date(c.endDate).getTime() - now.getTime()) / 86400000),
        }));
      } catch { return []; }
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await dbInstance.execute(
        `SELECT c.*, v.legalName as vendorName FROM contracts c LEFT JOIN vendors v ON c.vendorId = v.id WHERE c.id = ${input.id} AND c.organizationId = ${ctx.user.organizationId} LIMIT 1`
      ) as any;
      const contract = (rows[0] || [])[0];
      if (!contract) throw new TRPCError({ code: "NOT_FOUND" });
      return contract;
    }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(2),
      vendorId: z.number(),
      contractType: z.enum(["service","supply","maintenance","lease","consulting","other"]),
      startDate: z.string(),
      endDate: z.string(),
      value: z.number().optional(),
      currency: z.string().default("XOF"),
      autoRenew: z.boolean().default(false),
      noticePeriodDays: z.number().default(30),
      description: z.string().optional(),
      fileUrl: z.string().optional(),
      alertDaysBefore: z.number().default(30),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "procurement_manager") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const contractNumber = `CTR-${Date.now().toString().slice(-8)}`;
      const result = await dbInstance.execute(
        `INSERT INTO contracts (organizationId, contractNumber, title, vendorId, contractType, startDate, endDate, value, currency, autoRenew, noticePeriodDays, description, fileUrl, alertDaysBefore, status, createdBy)
         VALUES (${ctx.user.organizationId}, '${contractNumber}', '${input.title.replace(/'/g, "''")}', ${input.vendorId}, '${input.contractType}', '${input.startDate}', '${input.endDate}', ${input.value || "NULL"}, '${input.currency}', ${input.autoRenew ? 1 : 0}, ${input.noticePeriodDays}, ${input.description ? `'${input.description.replace(/'/g, "''")}'` : "NULL"}, ${input.fileUrl ? `'${input.fileUrl}'` : "NULL"}, ${input.alertDaysBefore}, 'active', ${ctx.user.id})`
      ) as any;
      const id = result[0]?.insertId;
      await createAuditLog({ organizationId: ctx.user.organizationId, entityType: "contract", entityId: id, action: "created", actorId: ctx.user.id, newValue: input });
      return { id, contractNumber };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      endDate: z.string().optional(),
      value: z.number().optional(),
      status: z.enum(["active","draft","terminated"]).optional(),
      autoRenew: z.boolean().optional(),
      noticePeriodDays: z.number().optional(),
      description: z.string().optional(),
      alertDaysBefore: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "procurement_manager") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...fields } = input;
      const sets = Object.entries(fields)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k} = ${typeof v === "string" ? `'${v.replace(/'/g, "''")}'` : v}`)
        .join(", ");
      if (sets) await dbInstance.execute(`UPDATE contracts SET ${sets}, updatedAt = NOW() WHERE id = ${id} AND organizationId = ${ctx.user.organizationId}`);
      await createAuditLog({ organizationId: ctx.user.organizationId, entityType: "contract", entityId: id, action: "updated", actorId: ctx.user.id, newValue: fields });
      return { success: true };
    }),

  getExpiring: protectedProcedure
    .input(z.object({ daysAhead: z.number().default(60) }))
    .query(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return [];
      try {
        const rows = await dbInstance.execute(
          `SELECT c.*, v.legalName as vendorName FROM contracts c LEFT JOIN vendors v ON c.vendorId = v.id WHERE c.organizationId = ${ctx.user.organizationId} AND c.status = 'active' AND c.endDate <= DATE_ADD(NOW(), INTERVAL ${input.daysAhead} DAY) AND c.endDate >= NOW() ORDER BY c.endDate ASC`
        ) as any;
        return (rows[0] || []) as any[];
      } catch { return []; }
    }),

  getStats: protectedProcedure.query(async ({ ctx }) => {
    const dbInstance = await db.getDb();
    if (!dbInstance) return { total: 0, active: 0, expiringSoon: 0, expired: 0, totalValue: 0 };
    try {
      const rows = await dbInstance.execute(
        `SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status='active' AND endDate >= NOW() THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN status='active' AND endDate BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as expiringSoon,
          SUM(CASE WHEN status='active' AND endDate < NOW() THEN 1 ELSE 0 END) as expired,
          SUM(COALESCE(value,0)) as totalValue
         FROM contracts WHERE organizationId = ${ctx.user.organizationId}`
      ) as any;
      return (rows[0] || [])[0] || { total: 0, active: 0, expiringSoon: 0, expired: 0, totalValue: 0 };
    } catch { return { total: 0, active: 0, expiringSoon: 0, expired: 0, totalValue: 0 }; }
  }),
});
