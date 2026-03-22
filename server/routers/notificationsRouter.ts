import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

export const notificationsRouter = router({

  list: protectedProcedure
    .input(z.object({ unreadOnly: z.boolean().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return [];
      const { notifications } = await import("../../drizzle/schema");
      const { eq, and, desc } = await import("drizzle-orm");
      const conditions: any[] = [eq(notifications.userId, ctx.user.id)];
      if (input?.unreadOnly) conditions.push(eq(notifications.isRead, false));
      return dbInstance.select().from(notifications)
        .where(and(...conditions))
        .orderBy(desc(notifications.createdAt))
        .limit(50);
    }),

  unreadCount: protectedProcedure
    .query(async ({ ctx }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return 0;
      const { notifications } = await import("../../drizzle/schema");
      const { eq, and, sql } = await import("drizzle-orm");
      const [result] = await dbInstance
        .select({ count: sql<number>`COUNT(*)` })
        .from(notifications)
        .where(and(eq(notifications.userId, ctx.user.id), eq(notifications.isRead, false)));
      return Number(result?.count ?? 0);
    }),

  markRead: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return;
      const { notifications } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      await dbInstance.update(notifications)
        .set({ isRead: true })
        .where(and(eq(notifications.id, input.id), eq(notifications.userId, ctx.user.id)));
      return { success: true };
    }),

  markAllRead: protectedProcedure
    .mutation(async ({ ctx }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return;
      const { notifications } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      await dbInstance.update(notifications)
        .set({ isRead: true })
        .where(and(eq(notifications.userId, ctx.user.id), eq(notifications.isRead, false)));
      return { success: true };
    }),

  // ── NEW: Delete a single notification ─────────────────────────────────────
  dismiss: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return;
      const { notifications } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      // Only delete own notifications
      await dbInstance.delete(notifications)
        .where(and(eq(notifications.id, input.id), eq(notifications.userId, ctx.user.id)));
      return { success: true };
    }),

  // ── NEW: Clear all read notifications ────────────────────────────────────
  clearRead: protectedProcedure
    .mutation(async ({ ctx }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return;
      const { notifications } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      await dbInstance.delete(notifications)
        .where(and(eq(notifications.userId, ctx.user.id), eq(notifications.isRead, true)));
      return { success: true };
    }),

  // ── NEW: Clear ALL notifications (nuclear option) ─────────────────────────
  clearAll: protectedProcedure
    .mutation(async ({ ctx }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return;
      const { notifications } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await dbInstance.delete(notifications)
        .where(eq(notifications.userId, ctx.user.id));
      return { success: true };
    }),
});
