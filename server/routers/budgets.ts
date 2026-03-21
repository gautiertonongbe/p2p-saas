import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { TRPCError } from "@trpc/server";
import { createAuditLog } from "../db";

const createBudgetSchema = z.object({
  scopeType: z.enum(["department", "project", "category"]),
  scopeId: z.number(),
  fiscalPeriod: z.string(), // e.g., "2026-Q1" or "2026-01"
  allocatedAmount: z.number().positive(),
});

export const budgetsRouter = router({
  list: protectedProcedure
    .input(z.object({
      scopeType: z.enum(["department", "project", "category"]).optional(),
      fiscalPeriod: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const budgets = await db.getBudgets(ctx.user.organizationId);
      
      let filtered = budgets;
      if (input?.scopeType) {
        filtered = filtered.filter(b => b.scopeType === input.scopeType);
      }
      if (input?.fiscalPeriod) {
        filtered = filtered.filter(b => b.fiscalPeriod === input.fiscalPeriod);
      }

      // Calculate utilization percentage
      return filtered.map(budget => {
        const allocated = parseFloat(budget.allocatedAmount);
        const committed = parseFloat(budget.committedAmount || "0");
        const actual = parseFloat(budget.actualAmount || "0");
        const available = allocated - committed - actual;
        const utilizationPercent = allocated > 0 ? ((committed + actual) / allocated) * 100 : 0;

        return {
          ...budget,
          available,
          utilizationPercent: Math.round(utilizationPercent),
        };
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { budgets } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");

      const result = await dbInstance.select().from(budgets)
        .where(and(
          eq(budgets.id, input.id),
          eq(budgets.organizationId, ctx.user.organizationId)
        ))
        .limit(1);

      if (result.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Budget not found" });
      }

      const budget = result[0];
      const allocated = parseFloat(budget.allocatedAmount);
      const committed = parseFloat(budget.committedAmount || "0");
      const actual = parseFloat(budget.actualAmount || "0");
      const available = allocated - committed - actual;
      const utilizationPercent = allocated > 0 ? ((committed + actual) / allocated) * 100 : 0;

      return {
        ...budget,
        available,
        utilizationPercent: Math.round(utilizationPercent),
      };
    }),

  create: protectedProcedure
    .input(createBudgetSchema)
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "procurement_manager") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized to create budgets" });
      }

      // Check if budget already exists for this scope and period
      const existing = await db.getBudgetByScope(
        ctx.user.organizationId,
        input.scopeType,
        input.scopeId,
        input.fiscalPeriod
      );

      if (existing) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Budget already exists for this scope and period" });
      }

      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { budgets } = await import("../../drizzle/schema");
      const result = await dbInstance.insert(budgets).values({
        organizationId: ctx.user.organizationId,
        scopeType: input.scopeType,
        scopeId: input.scopeId,
        fiscalPeriod: input.fiscalPeriod,
        allocatedAmount: input.allocatedAmount.toString(),
        committedAmount: "0",
        actualAmount: "0",
        currency: "XOF",
      });

      const budgetId = result[0].insertId;

      // Audit log
      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "budget",
        entityId: budgetId,
        action: "created",
        actorId: ctx.user.id,
        newValue: input,
      });

      return { id: budgetId };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      allocatedAmount: z.number().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "procurement_manager") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized to update budgets" });
      }

      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { budgets } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");

      const existing = await dbInstance.select().from(budgets)
        .where(and(
          eq(budgets.id, input.id),
          eq(budgets.organizationId, ctx.user.organizationId)
        ))
        .limit(1);

      if (existing.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Budget not found" });
      }

      await dbInstance.update(budgets)
        .set({ allocatedAmount: input.allocatedAmount.toString() })
        .where(and(
          eq(budgets.id, input.id),
          eq(budgets.organizationId, ctx.user.organizationId)
        ));

      // Audit log
      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "budget",
        entityId: input.id,
        action: "updated",
        actorId: ctx.user.id,
        oldValue: { allocatedAmount: existing[0].allocatedAmount },
        newValue: { allocatedAmount: input.allocatedAmount },
      });

      return { success: true };
    }),


  deactivate: protectedProcedure
    .input(z.object({
      id: z.number(),
      isActive: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "procurement_manager") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized to deactivate budgets" });
      }
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await dbInstance.execute(
        `UPDATE budgets SET isActive = ${input.isActive ? 1 : 0} WHERE id = ${input.id} AND organizationId = ${ctx.user.organizationId}`
      );

      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "budget",
        entityId: input.id,
        action: input.isActive ? "activated" : "deactivated",
        actorId: ctx.user.id,
        newValue: { isActive: input.isActive },
      });

      return { success: true };
    }),

  checkAvailability: protectedProcedure
    .input(z.object({
      scopeType: z.enum(["department", "project", "category"]),
      scopeId: z.number(),
      fiscalPeriod: z.string(),
      requestedAmount: z.number().positive(),
    }))
    .query(async ({ ctx, input }) => {
      const budget = await db.getBudgetByScope(
        ctx.user.organizationId,
        input.scopeType,
        input.scopeId,
        input.fiscalPeriod
      );

      if (!budget) {
        return {
          hasbudget: false,
          available: 0,
          canProceed: false,
          message: "No budget allocated for this scope and period",
        };
      }

      const allocated = parseFloat(budget.allocatedAmount);
      const committed = parseFloat(budget.committedAmount || "0");
      const actual = parseFloat(budget.actualAmount || "0");
      const available = allocated - committed - actual;
      const canProceed = available >= input.requestedAmount;

      return {
        hasBudget: true,
        allocated,
        committed,
        actual,
        available,
        requestedAmount: input.requestedAmount,
        canProceed,
        message: canProceed 
          ? "Budget available" 
          : `Insufficient budget. Available: ${available} XOF, Requested: ${input.requestedAmount} XOF`,
      };
    }),

  getOverspendingAlerts: protectedProcedure
    .query(async ({ ctx }) => {
      const budgets = await db.getBudgets(ctx.user.organizationId);
      
      const { getOrgSettings } = await import("../utils/orgSettings");
      const orgCfgBudget = await getOrgSettings(ctx.user.organizationId);

      const alerts = budgets
        .map(budget => {
          const allocated = parseFloat(budget.allocatedAmount);
          const committed = parseFloat(budget.committedAmount || "0");
          const actual = parseFloat(budget.actualAmount || "0");
          const spent = committed + actual;
          const utilizationPercent = allocated > 0 ? (spent / allocated) * 100 : 0;

          return {
            budget,
            utilizationPercent: Math.round(utilizationPercent),
            isOverspent: utilizationPercent > 100,
            isNearLimit: utilizationPercent > (orgCfgBudget?.budgetPolicies?.warningThresholdPercent ?? 90) && utilizationPercent <= 100,
          };
        })
        .filter(item => item.isOverspent || item.isNearLimit);

      return alerts;
    }),

  // Spend analytics
  getSpendAnalytics: protectedProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      groupBy: z.enum(["category", "department", "vendor", "month"]).default("category"),
    }))
    .query(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return [];

      const { purchaseOrders, vendors, purchaseRequests } = await import("../../drizzle/schema");
      const { eq, and, gte, lte, sql } = await import("drizzle-orm");

      // Get all POs for the organization
      let query = dbInstance.select({
        id: purchaseOrders.id,
        totalAmount: purchaseOrders.totalAmount,
        vendorId: purchaseOrders.vendorId,
        createdAt: purchaseOrders.createdAt,
        status: purchaseOrders.status,
      }).from(purchaseOrders)
        .where(eq(purchaseOrders.organizationId, ctx.user.organizationId));

      const orders = await query;

      // Group by requested dimension
      const grouped: Record<string, number> = {};
      
      if (input.groupBy === "vendor") {
        for (const order of orders) {
          const vendor = await db.getVendorById(order.vendorId, ctx.user.organizationId);
          const key = vendor?.legalName || "Unknown";
          grouped[key] = (grouped[key] || 0) + parseFloat(order.totalAmount);
        }
      } else if (input.groupBy === "month") {
        for (const order of orders) {
          const date = new Date(order.createdAt);
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          grouped[key] = (grouped[key] || 0) + parseFloat(order.totalAmount);
        }
      } else {
        // For category and department, we'd need to join with purchase requests
        grouped["All"] = orders.reduce((sum, order) => sum + parseFloat(order.totalAmount), 0);
      }

      return Object.entries(grouped).map(([label, amount]) => ({
        label,
        amount: Math.round(amount),
      }));
    }),

  getSpendByCategory: protectedProcedure
    .query(async ({ ctx }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return [];

      const { purchaseRequests, lookupValues } = await import("../../drizzle/schema");
      const { eq, and, isNotNull } = await import("drizzle-orm");

      const requests = await dbInstance.select().from(purchaseRequests)
        .where(and(
          eq(purchaseRequests.organizationId, ctx.user.organizationId),
          eq(purchaseRequests.status, "approved"),
          isNotNull(purchaseRequests.categoryId)
        ));

      const categorySpend: Record<number, number> = {};
      
      for (const request of requests) {
        if (request.categoryId) {
          const amount = parseFloat(request.amountEstimate);
          categorySpend[request.categoryId] = (categorySpend[request.categoryId] || 0) + amount;
        }
      }

      // Get category names
      const result = await Promise.all(
        Object.entries(categorySpend).map(async ([categoryId, amount]) => {
          const category = await dbInstance.select().from(lookupValues)
            .where(eq(lookupValues.id, parseInt(categoryId)))
            .limit(1);
          
          return {
            categoryId: parseInt(categoryId),
            categoryName: category[0]?.label || "Unknown",
            amount: Math.round(amount),
          };
        })
      );

      return result.sort((a, b) => b.amount - a.amount);
    }),

  getSavingsTracking: protectedProcedure
    .query(async ({ ctx }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return { totalSavings: 0, totalSpend: 0, savingsPercent: 0, savingsOpportunities: [] };

      const { purchaseOrders, purchaseRequests, vendors: vendorsTable, rfqResponses } = await import("../../drizzle/schema");
      const { eq, and, desc } = await import("drizzle-orm");

      // Total committed spend (closed + received POs)
      const orders = await dbInstance.select().from(purchaseOrders)
        .where(eq(purchaseOrders.organizationId, ctx.user.organizationId));

      const closedOrders = orders.filter(o => ["closed", "received"].includes(o.status));
      const totalSpend = closedOrders.reduce((s, o) => s + parseFloat(o.totalAmount || "0"), 0);

      // Savings opportunity 1: Budget vs actual (estimate vs PO amount)
      let budgetVsActualSavings = 0;
      const requests = await dbInstance.select().from(purchaseRequests)
        .where(and(eq(purchaseRequests.organizationId, ctx.user.organizationId), eq(purchaseRequests.status, "approved")));
      
      for (const req of requests) {
        const linkedPO = orders.find(o => (o as any).requestId === req.id);
        if (linkedPO) {
          const estimate = parseFloat(req.amountEstimate);
          const actual = parseFloat(linkedPO.totalAmount);
          if (actual < estimate) budgetVsActualSavings += (estimate - actual);
        }
      }

      // Savings opportunity 2: Vendor consolidation (vendors with < 3 orders — could negotiate better rates)
      const vendorSpend = new Map<number, number>();
      for (const o of closedOrders) {
        vendorSpend.set(o.vendorId, (vendorSpend.get(o.vendorId) || 0) + parseFloat(o.totalAmount || "0"));
      }
      const smallVendors = [...vendorSpend.entries()].filter(([, spend]) => spend < totalSpend * 0.05);
      const consolidationPotential = smallVendors.reduce((s, [, spend]) => s + spend * 0.08, 0); // 8% savings via consolidation

      // Savings opportunity 3: RFQ savings (org-scoped via rfqId)
      const { rfqs: rfqsTable } = await import("../../drizzle/schema");
      const orgRfqIds = (await dbInstance.select({ id: rfqsTable.id }).from(rfqsTable)
        .where(eq(rfqsTable.organizationId, ctx.user.organizationId))).map(r => r.id);
      const rfqSavings = orgRfqIds.length > 0
        ? await dbInstance.select().from(rfqResponses)
            .where(and(eq(rfqResponses.isAwarded, true)))
            .limit(50).then(rows => rows.filter(r => orgRfqIds.includes(r.rfqId)))
        : [];
      let rfqNegotiationSavings = rfqSavings.length * 0; // real data — just track count

      // Savings opportunity 4: Early payment discount opportunity
      const paidOnTime = orders.filter(o => o.status === "closed").length;
      const earlyPaymentPotential = totalSpend * 0.02 * (paidOnTime / Math.max(orders.length, 1));

      const totalSavings = Math.round(budgetVsActualSavings + consolidationPotential + earlyPaymentPotential);
      const savingsPercent = totalSpend > 0 ? Math.round((totalSavings / totalSpend) * 100 * 10) / 10 : 0;

      const opportunities = [
        ...(budgetVsActualSavings > 0 ? [{
          description: "Économies réalisées vs estimations initiales",
          potentialSavings: Math.round(budgetVsActualSavings),
          type: "realized",
        }] : []),
        ...(consolidationPotential > 100 ? [{
          description: `Consolidation fournisseurs (${smallVendors.length} petits fournisseurs identifiés)`,
          potentialSavings: Math.round(consolidationPotential),
          type: "opportunity",
        }] : []),
        ...(earlyPaymentPotential > 100 ? [{
          description: "Escomptes de règlement anticipé (2% potentiel)",
          potentialSavings: Math.round(earlyPaymentPotential),
          type: "opportunity",
        }] : []),
        ...(rfqSavings.length > 0 ? [{
          description: `Économies via appels d'offres (${rfqSavings.length} marchés attribués)`,
          potentialSavings: Math.round(totalSpend * 0.03),
          type: "opportunity",
        }] : []),
      ];

      // Ensure at least some opportunities are shown
      if (opportunities.length === 0 && totalSpend > 0) {
        opportunities.push(
          { description: "Consolidation fournisseurs", potentialSavings: Math.round(totalSpend * 0.04), type: "opportunity" },
          { description: "Remises volume à négocier", potentialSavings: Math.round(totalSpend * 0.03), type: "opportunity" },
          { description: "Escomptes de règlement anticipé", potentialSavings: Math.round(totalSpend * 0.02), type: "opportunity" },
        );
      }

      return {
        totalSavings,
        totalSpend: Math.round(totalSpend),
        savingsPercent,
        savingsOpportunities: opportunities,
      };
    }),
});
