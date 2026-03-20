import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { TRPCError } from "@trpc/server";
import { createAuditLog } from "../db";

const updateOrganizationSchema = z.object({
  // Identity
  legalName: z.string().min(1).max(255).optional(),
  tradeName: z.string().max(255).optional(),
  country: z.string().max(100).optional(),
  fiscalYearStart: z.string().regex(/^\d{2}-\d{2}$/).optional(),
  baseCurrency: z.string().length(3).optional(),
  // Contact & address
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().optional(),
  website: z.string().max(255).optional(),
  taxId: z.string().max(100).optional(),
  logoUrl: z.string().optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  // Full settings blob
  settings: z.object({
    toleranceRules: z.object({
      priceVariance: z.number().min(0).max(100),
      quantityVariance: z.number().min(0).max(100),
      amountVariance: z.number().min(0).max(100),
      autoApproveBelow: z.number().min(0).optional(),
    }).optional(),
    budgetPolicies: z.object({
      enforceBudgetCheck: z.boolean(),
      warningThresholdPercent: z.number().min(0).max(100),
      criticalThresholdPercent: z.number().min(0).max(100),
      allowOverspend: z.boolean(),
      requireBudgetCode: z.boolean(),
      carryForwardUnspent: z.boolean(),
    }).optional(),
    workflowSettings: z.object({
      autoApproveAmount: z.number().min(0),
      requireJustification: z.boolean(),
      minRFQVendors: z.number().min(1).max(20),
      rfqDeadlineDays: z.number().min(1).max(90),
      poAutoIssue: z.boolean(),
      slaHours: z.number().min(1).max(720),
      escalationEnabled: z.boolean(),
      segregationOfDuties: z.boolean(),
    }).optional(),
    notificationSettings: z.object({
      emailEnabled: z.boolean(),
      inAppEnabled: z.boolean(),
      events: z.object({
        newPurchaseRequest: z.boolean(),
        approvalRequired: z.boolean(),
        approvalApproved: z.boolean(),
        approvalRejected: z.boolean(),
        approvalOverdue: z.boolean(),
        budgetAlert: z.boolean(),
        invoiceReceived: z.boolean(),
        invoiceOverdue: z.boolean(),
        poIssued: z.boolean(),
        contractExpiring: z.boolean(),
        lowStock: z.boolean(),
        rfqResponse: z.boolean(),
      }),
    }).optional(),
    localization: z.object({
      language: z.string(),
      dateFormat: z.string(),
      numberFormat: z.string(),
      timezone: z.string(),
    }).optional(),
    numberingSequences: z.object({
      prPrefix: z.string().max(10),
      poPrefix: z.string().max(10),
      invoicePrefix: z.string().max(10),
      rfqPrefix: z.string().max(10),
    }).optional(),
    vendorPortal: z.object({
      enabled: z.boolean(),
      requireApprovalToOnboard: z.boolean(),
      allowSelfRegistration: z.boolean(),
    }).optional(),
    paymentTerms: z.array(z.object({
      code: z.string().min(1).max(20),
      label: z.string().min(1).max(100),
      days: z.number().min(0).max(365),
      discountPercent: z.number().min(0).max(100).optional(),
      discountDays: z.number().min(0).max(365).optional(),
    })).optional(),
    taxRates: z.array(z.object({
      code: z.string().min(1).max(20),
      label: z.string().min(1).max(100),
      rate: z.number().min(0).max(100),
      isDefault: z.boolean(),
    })).optional(),
    customFields: z.array(z.object({
      id: z.string(),
      entity: z.enum(["purchaseRequest", "purchaseOrder", "invoice", "vendor"]),
      label: z.string().min(1).max(100),
      type: z.enum(["text", "number", "date", "select", "boolean"]),
      required: z.boolean(),
      options: z.array(z.string()).optional(),
      isActive: z.boolean(),
    })).optional(),
    exchangeRates: z.record(z.string(), z.number()).optional(),
  }).optional(),
});

const updateUserSchema = z.object({
  userId: z.number(),
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  departmentId: z.number().optional(),
  role: z.enum(["admin", "procurement_manager", "approver", "requester"]).optional(),
  approvalLimit: z.string().optional(),
  status: z.enum(["active", "disabled"]).optional(),
});

const createDepartmentSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  managerId: z.number().optional(),
});

const updateDepartmentSchema = z.object({
  id: z.number(),
  code: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  managerId: z.number().optional(),
  isActive: z.boolean().optional(),
});

export const settingsRouter = router({
  // Organization settings
  getOrganization: protectedProcedure
    .query(async ({ ctx }) => {
      const organization = await db.getOrganizationById(ctx.user.organizationId);
      if (!organization) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
      }
      return organization;
    }),

  updateOrganization: protectedProcedure
    .input(updateOrganizationSchema)
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can update organization settings" });
      }

      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { organizations } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      // Fetch existing org to deep-merge settings
      const existing = await db.getOrganizationById(ctx.user.organizationId);
      const existingSettings = (existing as any)?.settings ?? {};

      const { settings, ...topLevelFields } = input;

      const mergedSettings = settings
        ? { ...existingSettings, ...settings }
        : existingSettings;

      const updateData: Record<string, unknown> = { ...topLevelFields };
      if (Object.keys(mergedSettings).length > 0) {
        updateData.settings = mergedSettings;
      }

      await dbInstance.update(organizations)
        .set(updateData as any)
        .where(eq(organizations.id, ctx.user.organizationId));

      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "organization",
        entityId: ctx.user.organizationId,
        action: "updated",
        actorId: ctx.user.id,
        newValue: input,
      });

      // Invalidate settings cache so business logic picks up new values immediately
      const { invalidateOrgSettingsCache } = await import("../utils/orgSettings");
      invalidateOrgSettingsCache(ctx.user.organizationId);

      return { success: true };
    }),

  // User management
  listUsers: protectedProcedure
    .query(async ({ ctx }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "procurement_manager") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized to view users" });
      }

      const dbInstance = await db.getDb();
      if (!dbInstance) return [];

      const { users } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      const userList = await dbInstance.select().from(users)
        .where(eq(users.organizationId, ctx.user.organizationId));

      return userList;
    }),

  updateUser: protectedProcedure
    .input(updateUserSchema)
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can update users" });
      }

      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { users } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");

      const { userId, ...updates } = input;

      await dbInstance.update(users)
        .set(updates)
        .where(and(
          eq(users.id, userId),
          eq(users.organizationId, ctx.user.organizationId)
        ));

      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "user",
        entityId: userId,
        action: "updated",
        actorId: ctx.user.id,
        newValue: updates,
      });

      return { success: true };
    }),

  // Department management
  listDepartments: protectedProcedure
    .query(async ({ ctx }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return [];

      const { departments } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      const deptList = await dbInstance.select().from(departments)
        .where(eq(departments.organizationId, ctx.user.organizationId));

      return deptList;
    }),

  createDepartment: protectedProcedure
    .input(createDepartmentSchema)
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can create departments" });
      }

      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { departments } = await import("../../drizzle/schema");

      const result = await dbInstance.insert(departments).values({
        organizationId: ctx.user.organizationId,
        ...input,
      });

      const insertId = Number((result as any).insertId || 0);

      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "department",
        entityId: insertId,
        action: "created",
        actorId: ctx.user.id,
        newValue: input,
      });

      return { success: true, id: insertId };
    }),

  updateDepartment: protectedProcedure
    .input(updateDepartmentSchema)
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can update departments" });
      }

      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { departments } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");

      const { id, ...updates } = input;

      await dbInstance.update(departments)
        .set(updates)
        .where(and(
          eq(departments.id, id),
          eq(departments.organizationId, ctx.user.organizationId)
        ));

      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "department",
        entityId: id,
        action: "updated",
        actorId: ctx.user.id,
        newValue: updates,
      });

      return { success: true };
    }),

  // Approval policies
  getApprovalPolicies: protectedProcedure
    .query(async ({ ctx }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return [];

      const { approvalPolicies } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      const policies = await dbInstance.select().from(approvalPolicies)
        .where(eq(approvalPolicies.organizationId, ctx.user.organizationId));

      return policies;
    }),

  getApprovalSteps: protectedProcedure
    .query(async ({ ctx }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return [];

      const { approvalSteps, approvalPolicies } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      // Get all policies for this organization first
      const policies = await dbInstance.select().from(approvalPolicies)
        .where(eq(approvalPolicies.organizationId, ctx.user.organizationId));

      const policyIds = policies.map(p => p.id);
      if (policyIds.length === 0) return [];

      const { inArray } = await import("drizzle-orm");
      const steps = await dbInstance.select().from(approvalSteps)
        .where(inArray(approvalSteps.policyId, policyIds));

      return steps;
    }),

  createApprovalPolicy: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      conditions: z.record(z.string(), z.any()).optional(),
      minAmount: z.number().optional(),
      maxAmount: z.number().optional(),
      requiresAllApprovals: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can create approval policies" });
      }

      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { approvalPolicies } = await import("../../drizzle/schema");

      const result = await dbInstance.insert(approvalPolicies).values({
        organizationId: ctx.user.organizationId,
        name: input.name,
        conditions: {
          minAmount: input.minAmount,
          maxAmount: input.maxAmount,
        },
        isActive: true,
      });

      const insertId = Number((result as any).insertId || 0);

      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "approval_policy",
        entityId: insertId,
        action: "created",
        actorId: ctx.user.id,
        newValue: input,
      });

      return { success: true, id: insertId };
    }),

  deleteApprovalPolicy: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can delete approval policies" });
      }

      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { approvalPolicies } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");

      await dbInstance.delete(approvalPolicies)
        .where(and(
          eq(approvalPolicies.id, input.id),
          eq(approvalPolicies.organizationId, ctx.user.organizationId)
        ));

      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "approval_policy",
        entityId: input.id,
        action: "deleted",
        actorId: ctx.user.id,
        newValue: null,
      });

      return { success: true };
    }),

  updateApprovalPolicies: protectedProcedure
    .input(z.record(z.string(), z.unknown()))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can update approval policies" });
      }

      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { organizations } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      const org = await db.getOrganizationById(ctx.user.organizationId);
      const currentSettings = org?.settings || {};

      await dbInstance.update(organizations)
        .set({
          settings: {
            ...currentSettings,
            approvalPolicies: input,
          } as any
        })
        .where(eq(organizations.id, ctx.user.organizationId));

      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "organization",
        entityId: ctx.user.organizationId,
        action: "approval_policies_updated",
        actorId: ctx.user.id,
        newValue: input,
      });

      return { success: true };
    }),

  // Budget policies
  getBudgetPolicies: protectedProcedure
    .query(async ({ ctx }) => {
      const organization = await db.getOrganizationById(ctx.user.organizationId);
      return organization?.settings?.budgetPolicies || {};
    }),

  updateBudgetPolicies: protectedProcedure
    .input(z.record(z.string(), z.unknown()))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can update budget policies" });
      }

      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { organizations } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      const org = await db.getOrganizationById(ctx.user.organizationId);
      const currentSettings = org?.settings || {};

      await dbInstance.update(organizations)
        .set({
          settings: {
            ...currentSettings,
            budgetPolicies: input,
          } as any
        })
        .where(eq(organizations.id, ctx.user.organizationId));

      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "organization",
        entityId: ctx.user.organizationId,
        action: "budget_policies_updated",
        actorId: ctx.user.id,
        newValue: input,
      });

      return { success: true };
    }),

  // Tolerance rules
  getToleranceRules: protectedProcedure
    .query(async ({ ctx }) => {
      const organization = await db.getOrganizationById(ctx.user.organizationId);
      return organization?.settings?.toleranceRules || {
        priceVariance: 5,
        quantityVariance: 2,
        amountVariance: 5,
      };
    }),

  updateToleranceRules: protectedProcedure
    .input(z.object({
      priceVariance: z.number().min(0).max(100).optional(),
      quantityVariance: z.number().min(0).max(100).optional(),
      amountVariance: z.number().min(0).max(100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can update tolerance rules" });
      }

      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { organizations } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      const org = await db.getOrganizationById(ctx.user.organizationId);
      const currentSettings = org?.settings || {};

      await dbInstance.update(organizations)
        .set({
          settings: {
            ...currentSettings,
            toleranceRules: input,
          } as any
        })
        .where(eq(organizations.id, ctx.user.organizationId));

      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "organization",
        entityId: ctx.user.organizationId,
        action: "tolerance_rules_updated",
        actorId: ctx.user.id,
        newValue: input,
      });

      return { success: true };
    }),

  // Audit logs
  getAuditLogs: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).optional().default(50),
    }))
    .query(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { auditLogs, users } = await import("../../drizzle/schema");
      const { eq, desc } = await import("drizzle-orm");

      const logs = await dbInstance
        .select({
          id: auditLogs.id,
          entityType: auditLogs.entityType,
          entityId: auditLogs.entityId,
          action: auditLogs.action,
          actorId: auditLogs.actorId,
          actorName: users.name,
          createdAt: auditLogs.timestamp,
        })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.actorId, users.id))
        .where(eq(auditLogs.organizationId, ctx.user.organizationId))
        .orderBy(desc(auditLogs.timestamp))
        .limit(input.limit);

      return logs;
    }),

  // Entity-specific audit logs
  getEntityHistory: protectedProcedure
    .input(z.object({
      entityType: z.string(),
      entityId: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { auditLogs, users } = await import("../../drizzle/schema");
      const { eq, and, desc } = await import("drizzle-orm");

      const logs = await dbInstance
        .select({
          id: auditLogs.id,
          action: auditLogs.action,
          actorId: auditLogs.actorId,
          actorName: users.name,
          createdAt: auditLogs.timestamp,
          oldValue: auditLogs.oldValue,
          newValue: auditLogs.newValue,
        })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.actorId, users.id))
        .where(
          and(
            eq(auditLogs.organizationId, ctx.user.organizationId),
            eq(auditLogs.entityType, input.entityType),
            eq(auditLogs.entityId, input.entityId)
          )
        )
        .orderBy(desc(auditLogs.timestamp));

      return logs;
    }),

  // ── APPROVAL POLICY STEPS ────────────────────────────────────────────────

  addApprovalStep: protectedProcedure
    .input(z.object({
      policyId: z.number(),
      stepOrder: z.number().min(1),
      approverType: z.enum(["role", "user", "manager"]),
      approverId: z.number().optional(),
      roleRef: z.enum(["admin", "procurement_manager", "approver"]).optional(),
      isParallel: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { approvalPolicies, approvalSteps } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      // Verify policy belongs to org
      const [policy] = await dbInstance.select().from(approvalPolicies)
        .where(and(eq(approvalPolicies.id, input.policyId), eq(approvalPolicies.organizationId, ctx.user.organizationId))).limit(1);
      if (!policy) throw new TRPCError({ code: "NOT_FOUND" });
      const r = await dbInstance.insert(approvalSteps).values({
        policyId: input.policyId,
        stepOrder: input.stepOrder,
        approverType: input.approverType,
        approverId: input.approverId,
        isParallel: input.isParallel,
      });
      return { id: Number((r as any).insertId) };
    }),

  deleteApprovalStep: protectedProcedure
    .input(z.object({ stepId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { approvalSteps, approvalPolicies } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      // Org check via join
      const [step] = await dbInstance.select().from(approvalSteps)
        .leftJoin(approvalPolicies, eq(approvalSteps.policyId, approvalPolicies.id))
        .where(and(eq(approvalSteps.id, input.stepId), eq(approvalPolicies.organizationId, ctx.user.organizationId))).limit(1);
      if (!step) throw new TRPCError({ code: "NOT_FOUND" });
      await dbInstance.delete(approvalSteps).where(eq(approvalSteps.id, input.stepId));
      return { success: true };
    }),

  // ── LOOKUP VALUES (cost centers, expense categories, GL accounts, projects) ─

  getLookupTypes: protectedProcedure.query(async ({ ctx }) => {
    const dbInstance = await db.getDb();
    if (!dbInstance) return [];
    const { lookupTypes } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    return dbInstance.select().from(lookupTypes).where(eq(lookupTypes.organizationId, ctx.user.organizationId));
  }),

  getLookupValues: protectedProcedure
    .input(z.object({ lookupTypeId: z.number() }))
    .query(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return [];
      const { lookupValues, lookupTypes } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      // Org guard via type
      const [lt] = await dbInstance.select().from(lookupTypes)
        .where(and(eq(lookupTypes.id, input.lookupTypeId), eq(lookupTypes.organizationId, ctx.user.organizationId))).limit(1);
      if (!lt) return [];
      return dbInstance.select().from(lookupValues).where(eq(lookupValues.lookupTypeId, input.lookupTypeId));
    }),

  createLookupValue: protectedProcedure
    .input(z.object({
      lookupTypeId: z.number(),
      code: z.string().min(1).max(50),
      label: z.string().min(1).max(255),
      parentValueId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { lookupValues, lookupTypes } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      const [lt] = await dbInstance.select().from(lookupTypes)
        .where(and(eq(lookupTypes.id, input.lookupTypeId), eq(lookupTypes.organizationId, ctx.user.organizationId))).limit(1);
      if (!lt) throw new TRPCError({ code: "NOT_FOUND", message: "Lookup type not found in your organisation" });
      const r = await dbInstance.insert(lookupValues).values({ ...input, isActive: true });
      return { id: Number((r as any).insertId) };
    }),

  updateLookupValue: protectedProcedure
    .input(z.object({
      id: z.number(),
      code: z.string().min(1).max(50).optional(),
      label: z.string().min(1).max(255).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { lookupValues, lookupTypes } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      // Org guard via join
      const [lv] = await dbInstance.select().from(lookupValues)
        .leftJoin(lookupTypes, eq(lookupValues.lookupTypeId, lookupTypes.id))
        .where(and(eq(lookupValues.id, input.id), eq(lookupTypes.organizationId, ctx.user.organizationId))).limit(1);
      if (!lv) throw new TRPCError({ code: "NOT_FOUND" });
      const { id, ...data } = input;
      await dbInstance.update(lookupValues).set(data).where(eq(lookupValues.id, id));
      return { success: true };
    }),


  // Invite user by email (creates account with temp password)
  inviteUser: protectedProcedure
    .input(z.object({
      email: z.string().email(),
      name: z.string().min(1),
      role: z.enum(["admin", "procurement_manager", "approver", "requester"]),
      departmentId: z.number().optional(),
      approvalLimit: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Seuls les admins peuvent inviter des utilisateurs" });
      }
      const dbInstance = await getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { users } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const { createRequire } = await import("module");
      const require = createRequire(import.meta.url);
      const bcrypt = require("bcryptjs");

      // Check if user already exists
      const existing = await dbInstance.select().from(users)
        .where(eq(users.email, input.email.toLowerCase())).limit(1);
      if (existing.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "Un utilisateur avec cet email existe déjà" });
      }

      // Generate a temporary password
      const tempPassword = Math.random().toString(36).slice(-8) + "A1!";
      const hashedPassword = await bcrypt.hash(tempPassword, 10);
      const openId = `user-${Date.now()}-${Math.random().toString(36).slice(-6)}`;

      await dbInstance.insert(users).values({
        openId,
        organizationId: ctx.user.organizationId,
        name: input.name,
        email: input.email.toLowerCase(),
        role: input.role,
        departmentId: input.departmentId,
        approvalLimit: input.approvalLimit,
        status: "active",
        loginMethod: "email",
        password: hashedPassword,
        lastSignedIn: new Date(),
      } as any);

      return { 
        success: true, 
        tempPassword,
        message: `Utilisateur créé. Mot de passe temporaire: ${tempPassword}` 
      };
    }),

  // Reset user password (admin sets a new temp password)
  resetUserPassword: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const dbInstance = await getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { users } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const { createRequire } = await import("module");
      const require = createRequire(import.meta.url);
      const bcrypt = require("bcryptjs");

      const tempPassword = Math.random().toString(36).slice(-8) + "A1!";
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      await dbInstance.update(users)
        .set({ password: hashedPassword } as any)
        .where(eq(users.id, input.userId));

      return { success: true, tempPassword };
    }),

  // Upload avatar (base64)
  uploadAvatar: protectedProcedure
    .input(z.object({ base64: z.string().max(1500000) })) // ~1MB max
    .mutation(async ({ ctx, input }) => {
      const dbInstance = await getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { users } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await dbInstance.update(users)
        .set({ avatarUrl: input.base64 } as any) // avatarUrl column added via ALTER TABLE
        .where(eq(users.id, ctx.user.id));
      return { success: true };
    }),

  // Get current user profile
  getMyProfile: protectedProcedure.query(async ({ ctx }) => {
    const dbInstance = await getDb();
    if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const { users } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const [u] = await dbInstance.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
    return u || null;
  }),

});