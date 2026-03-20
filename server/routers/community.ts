import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { TRPCError } from "@trpc/server";

// Safe parameterized-style escaping for raw SQL (TiDB doesn't support ? params via execute)
function esc(s: string | null | undefined): string {
  if (s === null || s === undefined) return "NULL";
  return `'${String(s).replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, c => {
    const map: Record<string, string> = { "\0": "\\0", "\x08": "\\b", "\x09": "\\t", "\x1a": "\\z", "\n": "\\n", "\r": "\\r", '"': '\\"', "'": "\\'", "\\": "\\\\", "%": "\\%"};
    return map[c] || c;
  })}'`;
}

async function verifyPostOwnership(db: any, postId: number, orgId: number) {
  const res = await db.execute(`SELECT id, authorId FROM communityPosts WHERE id = ${postId} AND organizationId = ${orgId} LIMIT 1`);
  const post = (res as any)[0]?.[0];
  if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "Publication introuvable" });
  return post;
}

async function verifyReplyInOrg(db: any, replyId: number, orgId: number) {
  const res = await db.execute(`
    SELECT cr.id, cr.authorId, cr.postId FROM communityReplies cr
    JOIN communityPosts cp ON cr.postId = cp.id
    WHERE cr.id = ${replyId} AND cp.organizationId = ${orgId}
    LIMIT 1
  `);
  const reply = (res as any)[0]?.[0];
  if (!reply) throw new TRPCError({ code: "NOT_FOUND", message: "Réponse introuvable" });
  return reply;
}

export const communityRouter = router({
  listPosts: protectedProcedure
    .input(z.object({
      type: z.enum(["question","tip","announcement","discussion"]).optional(),
      search: z.string().max(100).optional(),
      tag: z.string().max(50).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const where = [`cp.organizationId = ${ctx.user.organizationId}`];
      if (input?.type) where.push(`cp.type = ${esc(input.type)}`);
      if (input?.search) where.push(`(cp.title LIKE ${esc(`%${input.search}%`)} OR cp.content LIKE ${esc(`%${input.search}%`)})`);
      if (input?.tag) where.push(`cp.tags LIKE ${esc(`%${input.tag}%`)}`);
      const result = await db.execute(`
        SELECT cp.*, u.name as authorName,
          (SELECT COUNT(*) FROM communityReplies WHERE postId = cp.id) as replyCount,
          (SELECT COUNT(*) FROM communityReactions WHERE entityType = 'post' AND entityId = cp.id) as helpfulCount
        FROM communityPosts cp
        JOIN users u ON cp.authorId = u.id
        WHERE ${where.join(" AND ")}
        ORDER BY cp.isPinned DESC, cp.createdAt DESC
        LIMIT 100
      `);
      return (result as any)[0] || [];
    }),

  getPost: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.execute(`UPDATE communityPosts SET views = views + 1 WHERE id = ${input.id} AND organizationId = ${ctx.user.organizationId}`);
      const [postRes, repliesRes] = await Promise.all([
        db.execute(`
          SELECT cp.*, u.name as authorName,
            (SELECT COUNT(*) FROM communityReactions WHERE entityType = 'post' AND entityId = cp.id) as helpfulCount
          FROM communityPosts cp JOIN users u ON cp.authorId = u.id
          WHERE cp.id = ${input.id} AND cp.organizationId = ${ctx.user.organizationId}
          LIMIT 1
        `),
        db.execute(`
          SELECT cr.*, u.name as authorName,
            (SELECT COUNT(*) FROM communityReactions WHERE entityType = 'reply' AND entityId = cr.id) as helpfulCount
          FROM communityReplies cr
          JOIN communityPosts cp ON cr.postId = cp.id
          JOIN users u ON cr.authorId = u.id
          WHERE cr.postId = ${input.id} AND cp.organizationId = ${ctx.user.organizationId}
          ORDER BY cr.isAcceptedAnswer DESC, cr.createdAt ASC
        `),
      ]);
      const post = (postRes as any)[0]?.[0];
      if (!post) throw new TRPCError({ code: "NOT_FOUND" });
      return { ...post, replies: (repliesRes as any)[0] || [] };
    }),

  createPost: protectedProcedure
    .input(z.object({
      type: z.enum(["question","tip","announcement","discussion"]),
      title: z.string().min(5).max(255).trim(),
      content: z.string().min(10).max(10000).trim(),
      tags: z.string().max(200).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.type === "announcement" && ctx.user.role !== "admin" && ctx.user.role !== "procurement_manager") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Seuls les admins peuvent créer des annonces" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.execute(`
        INSERT INTO communityPosts (organizationId, authorId, type, title, content, tags)
        VALUES (${ctx.user.organizationId}, ${ctx.user.id}, ${esc(input.type)}, ${esc(input.title)}, ${esc(input.content)}, ${esc(input.tags)})
      `);
      const idRes = await db.execute(`SELECT LAST_INSERT_ID() as id`);
      return { id: (idRes as any)[0]?.[0]?.id };
    }),

  createReply: protectedProcedure
    .input(z.object({
      postId: z.number().int().positive(),
      content: z.string().min(5).max(5000).trim(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Verify post belongs to same org before allowing reply
      await verifyPostOwnership(db, input.postId, ctx.user.organizationId);
      await db.execute(`
        INSERT INTO communityReplies (postId, authorId, content)
        VALUES (${input.postId}, ${ctx.user.id}, ${esc(input.content)})
      `);
      return { success: true };
    }),

  acceptAnswer: protectedProcedure
    .input(z.object({ replyId: z.number().int().positive(), postId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Verify post belongs to org AND current user is author or admin
      const post = await verifyPostOwnership(db, input.postId, ctx.user.organizationId);
      if (post.authorId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Seul l'auteur peut accepter une réponse" });
      }
      // Verify reply belongs to this post in this org
      await verifyReplyInOrg(db, input.replyId, ctx.user.organizationId);
      await db.execute(`UPDATE communityReplies SET isAcceptedAnswer = false WHERE postId = ${input.postId}`);
      await db.execute(`UPDATE communityReplies SET isAcceptedAnswer = true WHERE id = ${input.replyId}`);
      await db.execute(`UPDATE communityPosts SET isResolved = true WHERE id = ${input.postId} AND organizationId = ${ctx.user.organizationId}`);
      return { success: true };
    }),

  react: protectedProcedure
    .input(z.object({
      entityType: z.enum(["post","reply"]),
      entityId: z.number().int().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Verify entity belongs to this org before allowing reaction
      if (input.entityType === "post") {
        await verifyPostOwnership(db, input.entityId, ctx.user.organizationId);
      } else {
        await verifyReplyInOrg(db, input.entityId, ctx.user.organizationId);
      }
      try {
        await db.execute(`
          INSERT INTO communityReactions (entityType, entityId, userId, type)
          VALUES (${esc(input.entityType)}, ${input.entityId}, ${ctx.user.id}, 'helpful')
        `);
      } catch {
        await db.execute(`
          DELETE FROM communityReactions WHERE entityType = ${esc(input.entityType)} AND entityId = ${input.entityId} AND userId = ${ctx.user.id}
        `);
      }
      return { success: true };
    }),

  togglePin: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "procurement_manager") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Only pin within same org
      await db.execute(`UPDATE communityPosts SET isPinned = NOT isPinned WHERE id = ${input.id} AND organizationId = ${ctx.user.organizationId}`);
      return { success: true };
    }),

  deletePost: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const post = await verifyPostOwnership(db, input.id, ctx.user.organizationId);
      if (post.authorId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await db.execute(`DELETE FROM communityReactions WHERE entityType = 'reply' AND entityId IN (SELECT id FROM communityReplies WHERE postId = ${input.id})`);
      await db.execute(`DELETE FROM communityReactions WHERE entityType = 'post' AND entityId = ${input.id}`);
      await db.execute(`DELETE FROM communityReplies WHERE postId = ${input.id}`);
      await db.execute(`DELETE FROM communityPosts WHERE id = ${input.id} AND organizationId = ${ctx.user.organizationId}`);
      return { success: true };
    }),

  stats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return {};
    const result = await db.execute(`
      SELECT
        COUNT(*) as totalPosts,
        SUM(CASE WHEN type = 'question' AND isResolved = false THEN 1 ELSE 0 END) as openQuestions,
        SUM(CASE WHEN type = 'tip' THEN 1 ELSE 0 END) as tips,
        SUM(CASE WHEN type = 'announcement' THEN 1 ELSE 0 END) as announcements
      FROM communityPosts WHERE organizationId = ${ctx.user.organizationId}
    `);
    return (result as any)[0]?.[0] || {};
  }),
});
