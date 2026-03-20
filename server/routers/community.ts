import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { TRPCError } from "@trpc/server";

function safe(s: string) { return s.replace(/'/g, "''"); }

export const communityRouter = router({
  // List posts
  listPosts: protectedProcedure
    .input(z.object({
      type: z.string().optional(),
      search: z.string().optional(),
      tag: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const where = [`cp.organizationId = ${ctx.user.organizationId}`];
      if (input?.type) where.push(`cp.type = '${input.type}'`);
      if (input?.search) where.push(`(cp.title LIKE '%${safe(input.search)}%' OR cp.content LIKE '%${safe(input.search)}%')`);
      if (input?.tag) where.push(`cp.tags LIKE '%${safe(input.tag)}%'`);
      const result = await db.execute(`
        SELECT cp.*, u.name as authorName, u.email as authorEmail,
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

  // Get single post with replies
  getPost: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Increment views
      await db.execute(`UPDATE communityPosts SET views = views + 1 WHERE id = ${input.id}`);
      const [postRes, repliesRes] = await Promise.all([
        db.execute(`
          SELECT cp.*, u.name as authorName, u.email as authorEmail,
            (SELECT COUNT(*) FROM communityReactions WHERE entityType = 'post' AND entityId = cp.id) as helpfulCount
          FROM communityPosts cp JOIN users u ON cp.authorId = u.id
          WHERE cp.id = ${input.id} AND cp.organizationId = ${ctx.user.organizationId}
          LIMIT 1
        `),
        db.execute(`
          SELECT cr.*, u.name as authorName, u.email as authorEmail,
            (SELECT COUNT(*) FROM communityReactions WHERE entityType = 'reply' AND entityId = cr.id) as helpfulCount
          FROM communityReplies cr JOIN users u ON cr.authorId = u.id
          WHERE cr.postId = ${input.id}
          ORDER BY cr.isAcceptedAnswer DESC, cr.createdAt ASC
        `),
      ]);
      const post = (postRes as any)[0]?.[0];
      if (!post) throw new TRPCError({ code: "NOT_FOUND" });
      return { ...post, replies: (repliesRes as any)[0] || [] };
    }),

  // Create post
  createPost: protectedProcedure
    .input(z.object({
      type: z.enum(["question", "tip", "announcement", "discussion"]),
      title: z.string().min(5),
      content: z.string().min(10),
      tags: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.type === "announcement" && ctx.user.role !== "admin" && ctx.user.role !== "procurement_manager") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Seuls les admins peuvent créer des annonces" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.execute(`
        INSERT INTO communityPosts (organizationId, authorId, type, title, content, tags)
        VALUES (${ctx.user.organizationId}, ${ctx.user.id},
          '${input.type}', '${safe(input.title)}', '${safe(input.content)}',
          ${input.tags ? `'${safe(input.tags)}'` : "NULL"})
      `);
      const idRes = await db.execute(`SELECT LAST_INSERT_ID() as id`);
      return { id: (idRes as any)[0]?.[0]?.id };
    }),

  // Reply to post
  createReply: protectedProcedure
    .input(z.object({ postId: z.number(), content: z.string().min(5) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.execute(`
        INSERT INTO communityReplies (postId, authorId, content)
        VALUES (${input.postId}, ${ctx.user.id}, '${safe(input.content)}')
      `);
      return { success: true };
    }),

  // Mark answer as accepted
  acceptAnswer: protectedProcedure
    .input(z.object({ replyId: z.number(), postId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Only post author or admin can accept
      await db.execute(`UPDATE communityReplies SET isAcceptedAnswer = false WHERE postId = ${input.postId}`);
      await db.execute(`UPDATE communityReplies SET isAcceptedAnswer = true WHERE id = ${input.replyId}`);
      await db.execute(`UPDATE communityPosts SET isResolved = true WHERE id = ${input.postId}`);
      return { success: true };
    }),

  // React (helpful/like)
  react: protectedProcedure
    .input(z.object({
      entityType: z.enum(["post", "reply"]),
      entityId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      try {
        await db.execute(`
          INSERT INTO communityReactions (entityType, entityId, userId, type)
          VALUES ('${input.entityType}', ${input.entityId}, ${ctx.user.id}, 'helpful')
        `);
      } catch {
        // Already reacted — toggle off
        await db.execute(`
          DELETE FROM communityReactions WHERE entityType = '${input.entityType}' AND entityId = ${input.entityId} AND userId = ${ctx.user.id}
        `);
      }
      return { success: true };
    }),

  // Pin/unpin (admin)
  togglePin: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "procurement_manager") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.execute(`UPDATE communityPosts SET isPinned = NOT isPinned WHERE id = ${input.id}`);
      return { success: true };
    }),

  // Stats
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
