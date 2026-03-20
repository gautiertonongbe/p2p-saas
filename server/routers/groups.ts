import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { TRPCError } from "@trpc/server";

function esc(s: string | null | undefined): string {
  if (s === null || s === undefined) return "NULL";
  return `'${String(s).replace(/[\0\x08\x09\x1a\n\r"'\\%]/g, c => ({
    "\0":"\\0","\x08":"\\b","\x09":"\\t","\x1a":"\\z","\n":"\\n",
    "\r":"\\r",'"':'\\"',"'":"\\'",'\\':"\\\\",'%':"\\%"
  } as any)[c] || c)}'`;
}

export const PERMISSIONS = [
  "view_documents",
  "approve_documents", 
  "access_expenses",
  "access_community",
  "access_analytics",
  "access_reports",
] as const;

export type Permission = typeof PERMISSIONS[number];

// Helper: get user's active group IDs
export async function getUserGroupIds(db: any, userId: number, orgId: number): Promise<number[]> {
  const res = await db.execute(`
    SELECT gm.groupId FROM groupMembers gm
    JOIN \`groups\` g ON gm.groupId = g.id
    WHERE gm.userId = ${userId} AND gm.status = 'active'
    AND g.organizationId = ${orgId} AND g.isActive = true
  `);
  return ((res as any)[0] || []).map((r: any) => r.groupId);
}

// Helper: check if user has permission via any group
export async function userHasPermission(db: any, userId: number, orgId: number, permission: Permission): Promise<boolean> {
  const res = await db.execute(`
    SELECT COUNT(*) as cnt FROM groupMembers gm
    JOIN \`groups\` g ON gm.groupId = g.id
    WHERE gm.userId = ${userId} AND gm.status = 'active'
    AND g.organizationId = ${orgId} AND g.isActive = true
    AND JSON_CONTAINS(g.permissions, '"${permission}"', '$')
  `);
  return Number((res as any)[0]?.[0]?.cnt) > 0;
}

// Helper: can user access a restricted document?
export async function canUserAccessDocument(
  db: any, userId: number, orgId: number,
  entityType: string, entityId: number, accessType: 'view' | 'approve'
): Promise<boolean> {
  // Check if document has any restrictions
  const restrictField = accessType === 'view' ? 'restrictView' : 'restrictApprove';
  const restrictRes = await db.execute(`
    SELECT COUNT(*) as cnt FROM documentGroups
    WHERE entityType = ${esc(entityType)} AND entityId = ${entityId}
    AND ${restrictField} = true
  `);
  const hasRestrictions = Number((restrictRes as any)[0]?.[0]?.cnt) > 0;
  if (!hasRestrictions) return true; // Open by default

  // Check if user is in any group that has access to this document
  const accessRes = await db.execute(`
    SELECT COUNT(*) as cnt FROM documentGroups dg
    JOIN groupMembers gm ON dg.groupId = gm.groupId
    WHERE dg.entityType = ${esc(entityType)} AND dg.entityId = ${entityId}
    AND dg.${restrictField} = true
    AND gm.userId = ${userId} AND gm.status = 'active'
  `);
  return Number((accessRes as any)[0]?.[0]?.cnt) > 0;
}

export const groupsRouter = router({
  // List all groups in org
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const result = await db.execute(`
      SELECT g.*,
        u.name as createdByName,
        (SELECT COUNT(*) FROM groupMembers WHERE groupId = g.id AND status = 'active') as memberCount,
        (SELECT COUNT(*) FROM groupMembers WHERE groupId = g.id AND status = 'pending') as pendingCount,
        (SELECT COUNT(*) > 0 FROM groupMembers WHERE groupId = g.id AND userId = ${ctx.user.id} AND status = 'active') as isMember,
        (SELECT COUNT(*) > 0 FROM groupMembers WHERE groupId = g.id AND userId = ${ctx.user.id} AND status = 'pending') as hasPendingRequest
      FROM \`groups\` g
      JOIN users u ON g.createdBy = u.id
      WHERE g.organizationId = ${ctx.user.organizationId}
      ORDER BY g.createdAt DESC
    `);
    return (result as any)[0] || [];
  }),

  // Get single group with members
  getById: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [groupRes, membersRes] = await Promise.all([
        db.execute(`
          SELECT g.*, u.name as createdByName
          FROM \`groups\` g JOIN users u ON g.createdBy = u.id
          WHERE g.id = ${input.id} AND g.organizationId = ${ctx.user.organizationId}
          LIMIT 1
        `),
        db.execute(`
          SELECT gm.*, u.name as userName, u.email as userEmail, u.role as userRole,
            a.name as approvedByName
          FROM groupMembers gm
          JOIN users u ON gm.userId = u.id
          LEFT JOIN users a ON gm.approvedBy = a.id
          WHERE gm.groupId = ${input.id}
          ORDER BY gm.status ASC, gm.requestedAt DESC
        `),
      ]);
      const group = (groupRes as any)[0]?.[0];
      if (!group) throw new TRPCError({ code: "NOT_FOUND" });
      return { ...group, members: (membersRes as any)[0] || [] };
    }),

  // Create group (admin only)
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(2).max(100).trim(),
      description: z.string().max(500).optional(),
      color: z.string().max(20).default("#2563eb"),
      permissions: z.array(z.enum(PERMISSIONS)),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "procurement_manager") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Seuls les admins peuvent créer des groupes" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.execute(`
        INSERT INTO \`groups\` (organizationId, name, description, color, permissions, createdBy)
        VALUES (${ctx.user.organizationId}, ${esc(input.name)}, ${esc(input.description)},
          ${esc(input.color)}, '${JSON.stringify(input.permissions)}', ${ctx.user.id})
      `);
      const idRes = await db.execute(`SELECT LAST_INSERT_ID() as id`);
      const groupId = (idRes as any)[0]?.[0]?.id;
      // Auto-add creator as group admin
      await db.execute(`INSERT INTO groupMembers (groupId, userId, role, status) VALUES (${groupId}, ${ctx.user.id}, 'admin', 'active')`);
      return { id: groupId };
    }),

  // Update group (admin only)
  update: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      name: z.string().min(2).max(100).trim().optional(),
      description: z.string().max(500).optional(),
      color: z.string().max(20).optional(),
      permissions: z.array(z.enum(PERMISSIONS)).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "procurement_manager") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const sets: string[] = [];
      if (input.name) sets.push(`name = ${esc(input.name)}`);
      if (input.description !== undefined) sets.push(`description = ${esc(input.description)}`);
      if (input.color) sets.push(`color = ${esc(input.color)}`);
      if (input.permissions) sets.push(`permissions = '${JSON.stringify(input.permissions)}'`);
      if (input.isActive !== undefined) sets.push(`isActive = ${input.isActive ? 1 : 0}`);
      if (sets.length === 0) return { success: true };
      await db.execute(`UPDATE \`groups\` SET ${sets.join(", ")} WHERE id = ${input.id} AND organizationId = ${ctx.user.organizationId}`);
      return { success: true };
    }),

  // Add member directly (admin assigns)
  addMember: protectedProcedure
    .input(z.object({ groupId: z.number().int().positive(), userId: z.number().int().positive(), role: z.enum(["member","admin"]).default("member") }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "procurement_manager") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Verify group belongs to org
      const groupRes = await db.execute(`SELECT id FROM \`groups\` WHERE id = ${input.groupId} AND organizationId = ${ctx.user.organizationId} LIMIT 1`);
      if (!(groupRes as any)[0]?.[0]) throw new TRPCError({ code: "NOT_FOUND" });
      await db.execute(`
        INSERT INTO groupMembers (groupId, userId, role, status, approvedBy, approvedAt)
        VALUES (${input.groupId}, ${input.userId}, ${esc(input.role)}, 'active', ${ctx.user.id}, NOW())
        ON DUPLICATE KEY UPDATE role = ${esc(input.role)}, status = 'active', approvedBy = ${ctx.user.id}, approvedAt = NOW()
      `);
      return { success: true };
    }),

  // Request to join (user requests)
  requestJoin: protectedProcedure
    .input(z.object({ groupId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const groupRes = await db.execute(`SELECT id FROM \`groups\` WHERE id = ${input.groupId} AND organizationId = ${ctx.user.organizationId} AND isActive = true LIMIT 1`);
      if (!(groupRes as any)[0]?.[0]) throw new TRPCError({ code: "NOT_FOUND" });
      try {
        await db.execute(`INSERT INTO groupMembers (groupId, userId, role, status) VALUES (${input.groupId}, ${ctx.user.id}, 'member', 'pending')`);
      } catch {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Vous avez déjà une demande en cours ou êtes déjà membre" });
      }
      return { success: true };
    }),

  // Approve/reject join request (admin)
  reviewRequest: protectedProcedure
    .input(z.object({
      groupId: z.number().int().positive(),
      userId: z.number().int().positive(),
      action: z.enum(["approve","reject"]),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "procurement_manager") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const status = input.action === "approve" ? "active" : "rejected";
      await db.execute(`
        UPDATE groupMembers SET status = ${esc(status)}, approvedBy = ${ctx.user.id}, approvedAt = NOW()
        WHERE groupId = ${input.groupId} AND userId = ${input.userId} AND status = 'pending'
      `);
      return { success: true };
    }),

  // Remove member
  removeMember: protectedProcedure
    .input(z.object({ groupId: z.number().int().positive(), userId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "procurement_manager") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.execute(`DELETE FROM groupMembers WHERE groupId = ${input.groupId} AND userId = ${input.userId}`);
      return { success: true };
    }),

  // Get my groups
  myGroups: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const result = await db.execute(`
      SELECT g.*, gm.role as myRole, gm.status as myStatus,
        (SELECT COUNT(*) FROM groupMembers WHERE groupId = g.id AND status = 'active') as memberCount
      FROM \`groups\` g
      JOIN groupMembers gm ON g.id = gm.groupId
      WHERE gm.userId = ${ctx.user.id} AND g.organizationId = ${ctx.user.organizationId}
      ORDER BY gm.status ASC, g.name ASC
    `);
    return (result as any)[0] || [];
  }),

  // Get my permissions (union of all group permissions)
  myPermissions: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const result = await db.execute(`
      SELECT DISTINCT g.permissions FROM \`groups\` g
      JOIN groupMembers gm ON g.id = gm.groupId
      WHERE gm.userId = ${ctx.user.id} AND gm.status = 'active'
      AND g.organizationId = ${ctx.user.organizationId} AND g.isActive = true
    `);
    const rows = (result as any)[0] || [];
    const perms = new Set<string>();
    rows.forEach((r: any) => {
      try { JSON.parse(r.permissions).forEach((p: string) => perms.add(p)); } catch {}
    });
    return Array.from(perms);
  }),

  // Assign document to group with restrictions
  assignDocument: protectedProcedure
    .input(z.object({
      entityType: z.enum(["purchaseRequest","purchaseOrder","invoice","contract","expense"]),
      entityId: z.number().int().positive(),
      groupId: z.number().int().positive(),
      restrictView: z.boolean().default(false),
      restrictApprove: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const groupRes = await db.execute(`SELECT id FROM \`groups\` WHERE id = ${input.groupId} AND organizationId = ${ctx.user.organizationId} LIMIT 1`);
      if (!(groupRes as any)[0]?.[0]) throw new TRPCError({ code: "NOT_FOUND" });
      await db.execute(`
        INSERT INTO documentGroups (entityType, entityId, groupId, restrictView, restrictApprove, createdBy)
        VALUES (${esc(input.entityType)}, ${input.entityId}, ${input.groupId}, ${input.restrictView ? 1 : 0}, ${input.restrictApprove ? 1 : 0}, ${ctx.user.id})
        ON DUPLICATE KEY UPDATE restrictView = ${input.restrictView ? 1 : 0}, restrictApprove = ${input.restrictApprove ? 1 : 0}
      `);
      return { success: true };
    }),

  // Get document's groups
  getDocumentGroups: protectedProcedure
    .input(z.object({
      entityType: z.string(),
      entityId: z.number().int().positive(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const result = await db.execute(`
        SELECT dg.*, g.name as groupName, g.color as groupColor
        FROM documentGroups dg
        JOIN \`groups\` g ON dg.groupId = g.id
        WHERE dg.entityType = ${esc(input.entityType)} AND dg.entityId = ${input.entityId}
        AND g.organizationId = ${ctx.user.organizationId}
      `);
      return (result as any)[0] || [];
    }),
});
