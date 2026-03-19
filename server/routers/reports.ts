import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { TRPCError } from "@trpc/server";

// ── Column definitions per entity ────────────────────────────────────────────
// Each column has: key (field path), label, type (for formatting), aggregatable
export const REPORT_ENTITIES = {
  purchaseRequests: {
    label: "Demandes d'achat",
    columns: [
      { key: "requestNumber",  label: "N° demande",       type: "string" },
      { key: "title",          label: "Titre",             type: "string" },
      { key: "status",         label: "Statut",            type: "status" },
      { key: "urgencyLevel",   label: "Urgence",           type: "string" },
      { key: "amountEstimate", label: "Montant estimé",    type: "amount" },
      { key: "departmentName", label: "Département",       type: "string" },
      { key: "categoryName",   label: "Catégorie",         type: "string" },
      { key: "requesterName",  label: "Demandeur",         type: "string" },
      { key: "createdAt",      label: "Date création",     type: "date" },
      { key: "currency",       label: "Devise",            type: "string" },
    ],
  },
  purchaseOrders: {
    label: "Bons de commande",
    columns: [
      { key: "poNumber",            label: "N° BC",              type: "string" },
      { key: "status",              label: "Statut",             type: "status" },
      { key: "totalAmount",         label: "Montant total",      type: "amount" },
      { key: "taxAmount",           label: "TVA",                type: "amount" },
      { key: "vendorName",          label: "Fournisseur",        type: "string" },
      { key: "currency",            label: "Devise",             type: "string" },
      { key: "expectedDeliveryDate",label: "Livraison prévue",   type: "date" },
      { key: "issuedAt",            label: "Date émission",      type: "date" },
      { key: "createdAt",           label: "Date création",      type: "date" },
    ],
  },
  invoices: {
    label: "Factures",
    columns: [
      { key: "invoiceNumber",  label: "N° facture",        type: "string" },
      { key: "status",         label: "Statut",            type: "status" },
      { key: "matchStatus",    label: "Rapprochement",     type: "status" },
      { key: "amount",         label: "Montant HT",        type: "amount" },
      { key: "taxAmount",      label: "TVA",               type: "amount" },
      { key: "currency",       label: "Devise",            type: "string" },
      { key: "vendorName",     label: "Fournisseur",       type: "string" },
      { key: "invoiceDate",    label: "Date facture",      type: "date" },
      { key: "dueDate",        label: "Date échéance",     type: "date" },
      { key: "createdAt",      label: "Date saisie",       type: "date" },
    ],
  },
  vendors: {
    label: "Fournisseurs",
    columns: [
      { key: "legalName",       label: "Raison sociale",    type: "string" },
      { key: "status",          label: "Statut",            type: "status" },
      { key: "country",         label: "Pays",              type: "string" },
      { key: "contactEmail",    label: "Email",             type: "string" },
      { key: "performanceScore",label: "Score performance", type: "number" },
      { key: "createdAt",       label: "Date création",     type: "date" },
    ],
  },
  payments: {
    label: "Paiements",
    columns: [
      { key: "reference",       label: "Référence",         type: "string" },
      { key: "paymentMethod",   label: "Mode de paiement",  type: "string" },
      { key: "amount",          label: "Montant",           type: "amount" },
      { key: "currency",        label: "Devise",            type: "string" },
      { key: "status",          label: "Statut",            type: "status" },
      { key: "valueDate",       label: "Date valeur",       type: "date" },
      { key: "vendorName",      label: "Fournisseur",       type: "string" },
      { key: "invoiceNumber",   label: "N° facture",        type: "string" },
      { key: "createdAt",       label: "Date saisie",       type: "date" },
    ],
  },
  budgets: {
    label: "Budgets",
    columns: [
      { key: "fiscalPeriod",     label: "Période",            type: "string" },
      { key: "scopeType",        label: "Type",               type: "string" },
      { key: "scopeName",        label: "Périmètre",          type: "string" },
      { key: "allocatedAmount",  label: "Alloué",             type: "amount" },
      { key: "committedAmount",  label: "Engagé",             type: "amount" },
      { key: "actualAmount",     label: "Consommé",           type: "amount" },
      { key: "available",        label: "Disponible",         type: "amount" },
      { key: "currency",         label: "Devise",             type: "string" },
    ],
  },
} as const;

export type ReportEntity = keyof typeof REPORT_ENTITIES;

const reportFilterSchema = z.object({
  field: z.string(),
  operator: z.enum(["eq", "ne", "gt", "gte", "lt", "lte", "contains", "in"]),
  value: z.union([z.string(), z.number(), z.array(z.string())]),
});

const reportDefinitionSchema = z.object({
  entity: z.string(),
  columns: z.array(z.string()).min(1),
  filters: z.array(reportFilterSchema).optional(),
  groupBy: z.string().optional(),
  sortBy: z.string().optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  limit: z.number().min(1).max(5000).default(500),
});

export const reportsRouter = router({

  // List available entities and their columns
  getSchema: protectedProcedure.query(() => {
    return Object.entries(REPORT_ENTITIES).map(([key, def]) => ({
      key,
      label: def.label,
      columns: def.columns,
    }));
  }),

  // Execute a report query and return rows
  runQuery: protectedProcedure
    .input(reportDefinitionSchema)
    .query(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const orgId = ctx.user.organizationId;
      let rows: any[] = [];

      // ── Fetch base data per entity ───────────────────────────────────────
      if (input.entity === "purchaseRequests") {
        const { purchaseRequests, departments, users, lookupValues } = await import("../../drizzle/schema");
        const { eq, and, gte, lte, like, inArray } = await import("drizzle-orm");

        let query = dbInstance.select().from(purchaseRequests)
          .where(eq(purchaseRequests.organizationId, orgId));

        const rawRows = await query.limit(input.limit);

        // Enrich
        rows = await Promise.all(rawRows.map(async (r) => {
          const dept = r.departmentId ? (await dbInstance.select().from(departments).where(eq(departments.id, r.departmentId)).limit(1))[0] : null;
          const requester = (await dbInstance.select().from(users).where(eq(users.id, r.requesterId)).limit(1))[0];
          const category = r.categoryId ? (await dbInstance.select().from(lookupValues).where(eq(lookupValues.id, r.categoryId)).limit(1))[0] : null;
          return {
            ...r,
            departmentName: dept?.name ?? "—",
            requesterName: requester?.name ?? "—",
            categoryName: category?.label ?? "—",
          };
        }));
      }

      else if (input.entity === "purchaseOrders") {
        const { purchaseOrders, vendors: vendorsTable } = await import("../../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const rawRows = await dbInstance.select().from(purchaseOrders).where(eq(purchaseOrders.organizationId, orgId)).limit(input.limit);
        const vendorIds = [...new Set(rawRows.map(r => r.vendorId))];
        const vendorMap = new Map<number, string>();
        for (const vid of vendorIds) {
          const [v] = await dbInstance.select().from(vendorsTable).where(eq(vendorsTable.id, vid)).limit(1);
          if (v) vendorMap.set(vid, v.legalName);
        }
        rows = rawRows.map(r => ({ ...r, vendorName: vendorMap.get(r.vendorId) ?? "—" }));
      }

      else if (input.entity === "invoices") {
        const { invoices, vendors: vendorsTable } = await import("../../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const rawRows = await dbInstance.select().from(invoices).where(eq(invoices.organizationId, orgId)).limit(input.limit);
        const vendorIds = [...new Set(rawRows.map(r => r.vendorId))];
        const vendorMap = new Map<number, string>();
        for (const vid of vendorIds) {
          const [v] = await dbInstance.select().from(vendorsTable).where(eq(vendorsTable.id, vid)).limit(1);
          if (v) vendorMap.set(vid, v.legalName);
        }
        rows = rawRows.map(r => ({ ...r, vendorName: vendorMap.get(r.vendorId) ?? "—" }));
      }

      else if (input.entity === "vendors") {
        const { vendors: vendorsTable } = await import("../../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        rows = await dbInstance.select().from(vendorsTable).where(eq(vendorsTable.organizationId, orgId)).limit(input.limit);
      }

      else if (input.entity === "payments") {
        const { payments, invoices, vendors: vendorsTable } = await import("../../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const rawRows = await dbInstance.select().from(payments).where(eq(payments.organizationId, orgId)).limit(input.limit);
        rows = await Promise.all(rawRows.map(async (p) => {
          const [inv] = await dbInstance.select().from(invoices).where(eq(invoices.id, p.invoiceId)).limit(1);
          const vendor = inv ? (await dbInstance.select().from(vendorsTable).where(eq(vendorsTable.id, inv.vendorId)).limit(1))[0] : null;
          return { ...p, invoiceNumber: inv?.invoiceNumber ?? "—", vendorName: vendor?.legalName ?? "—" };
        }));
      }

      else if (input.entity === "budgets") {
        const { budgets, departments, lookupValues } = await import("../../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const rawRows = await dbInstance.select().from(budgets).where(eq(budgets.organizationId, orgId)).limit(input.limit);
        rows = await Promise.all(rawRows.map(async (b) => {
          let scopeName = "—";
          if (b.scopeType === "department" && b.scopeId) {
            const [d] = await dbInstance.select().from(departments).where(eq(departments.id, b.scopeId)).limit(1);
            scopeName = d?.name ?? "—";
          } else if (b.scopeId) {
            const [lv] = await dbInstance.select().from(lookupValues).where(eq(lookupValues.id, b.scopeId)).limit(1);
            scopeName = lv?.label ?? "—";
          }
          const allocated = parseFloat(b.allocatedAmount);
          const committed = parseFloat(b.committedAmount ?? "0");
          const actual = parseFloat(b.actualAmount ?? "0");
          return { ...b, scopeName, available: allocated - committed - actual };
        }));
      }

      // ── Apply client-side filters ────────────────────────────────────────
      if (input.filters?.length) {
        for (const f of input.filters) {
          rows = rows.filter(row => {
            const val = row[f.field];
            const fv = f.value;
            switch (f.operator) {
              case "eq": return String(val) === String(fv);
              case "ne": return String(val) !== String(fv);
              case "gt": return (val instanceof Date ? val : new Date(val)).getTime() > (isNaN(Number(fv)) ? new Date(fv).getTime() : Number(fv));
              case "gte": return (val instanceof Date ? val : new Date(val)).getTime() >= (isNaN(Number(fv)) ? new Date(fv).getTime() : Number(fv));
              case "lt": return (val instanceof Date ? val : new Date(val)).getTime() < (isNaN(Number(fv)) ? new Date(fv).getTime() : Number(fv));
              case "lte": return (val instanceof Date ? val : new Date(val)).getTime() <= (isNaN(Number(fv)) ? new Date(fv).getTime() : Number(fv));
              case "contains": return String(val).toLowerCase().includes(String(fv).toLowerCase());
              case "in": return Array.isArray(fv) && fv.includes(String(val));
              default: return true;
            }
          });
        }
      }

      // ── Apply sorting ────────────────────────────────────────────────────
      if (input.sortBy) {
        const dir = input.sortDir === "desc" ? -1 : 1;
        rows.sort((a, b) => {
          const av = a[input.sortBy!];
          const bv = b[input.sortBy!];
          if (av == null) return 1;
          if (bv == null) return -1;
          if (typeof av === "number") return (av - bv) * dir;
          return String(av).localeCompare(String(bv)) * dir;
        });
      }

      // ── Apply groupBy aggregation ────────────────────────────────────────
      if (input.groupBy) {
        const grouped = new Map<string, { count: number; rows: any[] }>();
        for (const row of rows) {
          const key = String(row[input.groupBy] ?? "—");
          if (!grouped.has(key)) grouped.set(key, { count: 0, rows: [] });
          grouped.get(key)!.count++;
          grouped.get(key)!.rows.push(row);
        }

        // Compute aggregates for numeric columns
        const entityDef = REPORT_ENTITIES[input.entity as ReportEntity];
        const amountCols = entityDef ? entityDef.columns.filter(c => c.type === "amount" || c.type === "number").map(c => c.key) : [];

        rows = [...grouped.entries()].map(([groupKey, g]) => {
          const agg: any = { [input.groupBy!]: groupKey, count: g.count };
          for (const col of amountCols) {
            agg[`${col}_sum`] = g.rows.reduce((s, r) => s + (parseFloat(r[col]) || 0), 0);
            agg[`${col}_avg`] = agg[`${col}_sum`] / g.count;
          }
          return agg;
        });

        if (input.sortBy) {
          const dir = input.sortDir === "desc" ? -1 : 1;
          rows.sort((a, b) => (Number(a[input.sortBy!]) - Number(b[input.sortBy!])) * dir);
        }
      }

      // ── Project to selected columns only ────────────────────────────────
      const projectedRows = input.groupBy
        ? rows
        : rows.map(row => {
          const out: any = {};
          for (const col of input.columns) out[col] = row[col] ?? null;
          return out;
        });

      return {
        rows: projectedRows,
        totalRows: rows.length,
        entity: input.entity,
        groupBy: input.groupBy,
      };
    }),

  // Save a report definition
  saveReport: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      definition: reportDefinitionSchema,
      isShared: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { savedViews } = await import("../../drizzle/schema");
      const r = await dbInstance.insert(savedViews).values({
        organizationId: ctx.user.organizationId,
        userId: ctx.user.id,
        entity: input.definition.entity,
        name: input.name,
        filters: input.definition as any,
        columns: input.definition.columns,
        isDefault: false,
      });

      return { id: Number((r as any).insertId) };
    }),

  listReports: protectedProcedure.query(async ({ ctx }) => {
    const dbInstance = await db.getDb();
    if (!dbInstance) return [];

    const { savedViews, users } = await import("../../drizzle/schema");
    const { eq, or } = await import("drizzle-orm");

    // Return user's own reports
    const rows = await dbInstance.select().from(savedViews)
      .where(eq(savedViews.organizationId, ctx.user.organizationId));

    return rows.map(r => ({
      ...r,
      definition: r.filters as any,
    }));
  }),

  deleteReport: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { savedViews } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");

      await dbInstance.delete(savedViews)
        .where(and(
          eq(savedViews.id, input.id),
          eq(savedViews.organizationId, ctx.user.organizationId)
        ));

      return { success: true };
    }),
});
