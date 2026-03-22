import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
const safe = (s: string) => String(s || "").replace(/'/g, "''");
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "../_core/llm";
import { notifyOwner } from "../_core/notification";

export const aiInsightsRouter = router({
  // Generate AI-powered supplier performance insights
  analyzeSupplierPerformance: protectedProcedure
    .input(z.object({
      vendorId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const vendor = await db.getVendorById(input.vendorId, ctx.user.organizationId);
      if (!vendor) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Vendor not found" });
      }

      // Get vendor's orders
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { purchaseOrders, invoices, receipts } = await import("../../drizzle/schema");
      const { eq, and, desc } = await import("drizzle-orm");

      const orders = await dbInstance.select().from(purchaseOrders)
        .where(and(
          eq(purchaseOrders.organizationId, ctx.user.organizationId),
          eq(purchaseOrders.vendorId, input.vendorId)
        ))
        .orderBy(desc(purchaseOrders.createdAt))
        .limit(50);

      // Get invoices
      const vendorInvoices = await dbInstance.select().from(invoices)
        .where(and(
          eq(invoices.organizationId, ctx.user.organizationId),
          eq(invoices.vendorId, input.vendorId)
        ))
        .limit(50);

      // Prepare data for AI analysis
      const analysisData = {
        vendorName: vendor.legalName,
        totalOrders: orders.length,
        totalSpend: orders.reduce((sum, o) => sum + parseFloat(o.totalAmount), 0),
        orderStatuses: orders.map(o => o.status),
        invoiceCount: vendorInvoices.length,
        invoiceStatuses: vendorInvoices.map(i => i.status),
        avgOrderAmount: orders.length > 0 
          ? orders.reduce((sum, o) => sum + parseFloat(o.totalAmount), 0) / orders.length 
          : 0,
      };

      try {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: "You are a procurement analytics expert specializing in supplier performance analysis. Analyze the provided data and generate insights on delivery performance, pricing trends, and risk assessment. Be specific and actionable.",
            },
            {
              role: "user",
              content: `Analyze this supplier's performance data and provide insights:\n\n${JSON.stringify(analysisData, null, 2)}\n\nProvide:\n1. Delivery Performance Assessment (on-time rate, reliability)\n2. Pricing Trends (stable, increasing, decreasing)\n3. Risk Assessment (low, medium, high) with reasons\n4. Recommendations for optimization`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "supplier_analysis",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  deliveryPerformance: {
                    type: "object",
                    properties: {
                      rating: { type: "string", enum: ["excellent", "good", "fair", "poor"] },
                      onTimeRate: { type: "number", description: "Percentage 0-100" },
                      summary: { type: "string" },
                    },
                    required: ["rating", "onTimeRate", "summary"],
                    additionalProperties: false,
                  },
                  pricingTrends: {
                    type: "object",
                    properties: {
                      trend: { type: "string", enum: ["stable", "increasing", "decreasing", "volatile"] },
                      summary: { type: "string" },
                    },
                    required: ["trend", "summary"],
                    additionalProperties: false,
                  },
                  riskAssessment: {
                    type: "object",
                    properties: {
                      level: { type: "string", enum: ["low", "medium", "high"] },
                      factors: { type: "array", items: { type: "string" } },
                      summary: { type: "string" },
                    },
                    required: ["level", "factors", "summary"],
                    additionalProperties: false,
                  },
                  recommendations: {
                    type: "array",
                    items: { type: "string" },
                    description: "Actionable recommendations",
                  },
                },
                required: ["deliveryPerformance", "pricingTrends", "riskAssessment", "recommendations"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = response.choices[0].message.content;
        const insights = typeof content === 'string' ? JSON.parse(content) : {};

        return {
          success: true,
          insights,
          dataSnapshot: analysisData,
        };
      } catch (error) {
        console.error("[AI Insights] Error:", error);
        throw new TRPCError({ 
          code: "INTERNAL_SERVER_ERROR", 
          message: "Failed to generate supplier insights" 
        });
      }
    }),

  // Generate spend optimization recommendations
  generateSpendOptimizationInsights: protectedProcedure
    .mutation(async ({ ctx }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { purchaseOrders, vendors, budgets } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      // Get spend data
      const orders = await dbInstance.select().from(purchaseOrders)
        .where(eq(purchaseOrders.organizationId, ctx.user.organizationId))
        .limit(100);

      const allBudgets = await db.getBudgets(ctx.user.organizationId);

      // Get vendor count
      const allVendors = await db.getVendors(ctx.user.organizationId);

      const spendData = {
        totalSpend: orders.reduce((sum, o) => sum + parseFloat(o.totalAmount), 0),
        orderCount: orders.length,
        vendorCount: allVendors.length,
        budgetCount: allBudgets.length,
        avgOrderValue: orders.length > 0 
          ? orders.reduce((sum, o) => sum + parseFloat(o.totalAmount), 0) / orders.length 
          : 0,
      };

      try {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: "You are a procurement optimization consultant. Analyze spend patterns and provide actionable recommendations to reduce costs, improve efficiency, and optimize vendor relationships.",
            },
            {
              role: "user",
              content: `Analyze this organization's procurement data and provide optimization insights:\n\n${JSON.stringify(spendData, null, 2)}\n\nProvide specific, actionable recommendations for:\n1. Cost reduction opportunities\n2. Process efficiency improvements\n3. Vendor management optimization\n4. Budget allocation suggestions`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "optimization_insights",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  costReduction: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        opportunity: { type: "string" },
                        estimatedSavings: { type: "number" },
                        priority: { type: "string", enum: ["high", "medium", "low"] },
                      },
                      required: ["opportunity", "estimatedSavings", "priority"],
                      additionalProperties: false,
                    },
                  },
                  processImprovements: {
                    type: "array",
                    items: { type: "string" },
                  },
                  vendorOptimization: {
                    type: "array",
                    items: { type: "string" },
                  },
                  budgetAllocation: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
                required: ["costReduction", "processImprovements", "vendorOptimization", "budgetAllocation"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = response.choices[0].message.content;
        const insights = typeof content === 'string' ? JSON.parse(content) : {};

        return {
          success: true,
          insights,
          dataSnapshot: spendData,
        };
      } catch (error) {
        console.error("[AI Insights] Error:", error);
        throw new TRPCError({ 
          code: "INTERNAL_SERVER_ERROR", 
          message: "Failed to generate optimization insights" 
        });
      }
    }),

  // Send notification for approval needed
  sendApprovalNotification: protectedProcedure
    .input(z.object({
      approvalId: z.number(),
      requestId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const request = await db.getPurchaseRequestById(input.requestId, ctx.user.organizationId);
      if (!request) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Purchase request not found" });
      }

      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { approvals } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      const approval = await dbInstance.select().from(approvals)
        .where(eq(approvals.id, input.approvalId))
        .limit(1);

      if (approval.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Approval not found" });
      }

      const approver = await db.getUserById(approval[0].approverId);
      if (!approver) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Approver not found" });
      }

      // In production, send email via email service
      // For now, notify owner as demonstration
      const notificationSent = await notifyOwner({
        title: `Approval Required: ${request.title}`,
        content: `Purchase request ${request.requestNumber} requires approval from ${approver.name}. Amount: ${request.amountEstimate} XOF. Urgency: ${request.urgencyLevel}.`,
      });

      return {
        success: notificationSent,
        message: notificationSent ? "Notification sent" : "Failed to send notification",
      };
    }),

  // Send status change notification
  sendStatusChangeNotification: protectedProcedure
    .input(z.object({
      entityType: z.enum(["purchaseRequest", "purchaseOrder", "invoice"]),
      entityId: z.number(),
      oldStatus: z.string(),
      newStatus: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      let entity: any = null;
      let entityNumber = "";
      let requester: any = null;

      if (input.entityType === "purchaseRequest") {
        entity = await db.getPurchaseRequestById(input.entityId, ctx.user.organizationId);
        entityNumber = entity?.requestNumber || "";
        if (entity) requester = await db.getUserById(entity.requesterId);
      } else if (input.entityType === "purchaseOrder") {
        entity = await db.getPurchaseOrderById(input.entityId, ctx.user.organizationId);
        entityNumber = entity?.poNumber || "";
      } else if (input.entityType === "invoice") {
        entity = await db.getInvoiceById(input.entityId, ctx.user.organizationId);
        entityNumber = entity?.invoiceNumber || "";
      }

      if (!entity) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Entity not found" });
      }

      // Send notification
      const notificationSent = await notifyOwner({
        title: `Status Update: ${safe(input.entityType)} ${entityNumber}`,
        content: `Status changed from "${safe(input.oldStatus)}" to "${safe(input.newStatus)}". ${requester ? `Requester: ${requester.name}` : ""}`,
      });

      return {
        success: notificationSent,
        message: notificationSent ? "Notification sent" : "Failed to send notification",
      };
    }),

  // Send payment due notification
  sendPaymentDueNotification: protectedProcedure
    .input(z.object({
      invoiceId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const invoice = await db.getInvoiceById(input.invoiceId, ctx.user.organizationId);
      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }

      const vendor = await db.getVendorById(invoice.vendorId, ctx.user.organizationId);
      
      const daysUntilDue = invoice.dueDate 
        ? Math.ceil((new Date(invoice.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null;

      const notificationSent = await notifyOwner({
        title: `Payment Due: Invoice ${invoice.invoiceNumber}`,
        content: `Invoice from ${vendor?.legalName || "Unknown"} for ${invoice.amount} XOF is due ${daysUntilDue !== null ? `in ${daysUntilDue} days` : "soon"}. Please process payment.`,
      });

      return {
        success: notificationSent,
        message: notificationSent ? "Notification sent" : "Failed to send notification",
      };
    }),
});
