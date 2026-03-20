import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { sdk } from "../_core/sdk";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { TRPCError } from "@trpc/server";

export const impersonateRouter = router({
  // Start impersonating a user
  start: protectedProcedure
    .input(z.object({ targetUserId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can impersonate users" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [target] = await db.select().from(users).where(eq(users.id, input.targetUserId)).limit(1);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      if (target.id === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot impersonate yourself" });

      // Store original admin openId in a separate cookie
      const cookieOptions = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" };
      ctx.res.cookie("original_admin_openId", ctx.user.openId, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      // Create session token for target user
      const sessionToken = await sdk.createSessionToken(target.openId, {
        name: target.name || target.email || "",
        expiresInMs: ONE_YEAR_MS,
      });

      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      return { success: true, user: { id: target.id, name: target.name, email: target.email, role: target.role } };
    }),

  // Stop impersonating — return to admin
  stop: protectedProcedure
    .mutation(async ({ ctx }) => {
      const cookies = ctx.req.headers.cookie || "";
      const match = cookies.match(/original_admin_openId=([^;]+)/);
      const adminOpenId = match ? decodeURIComponent(match[1]) : null;

      if (!adminOpenId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Not currently impersonating" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [admin] = await db.select().from(users).where(eq(users.openId, adminOpenId)).limit(1);
      if (!admin) throw new TRPCError({ code: "NOT_FOUND" });

      const sessionToken = await sdk.createSessionToken(admin.openId, {
        name: admin.name || admin.email || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" };
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      ctx.res.clearCookie("original_admin_openId", { path: "/" });

      return { success: true, user: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } };
    }),

  // List users available to impersonate
  listUsers: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const db = await getDb();
    if (!db) return [];
    const allUsers = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      status: users.status,
    }).from(users).where(eq(users.organizationId, ctx.user.organizationId));
    return allUsers.filter(u => u.id !== ctx.user.id);
  }),

  // Check if currently impersonating
  status: protectedProcedure.query(async ({ ctx }) => {
    const cookies = ctx.req.headers.cookie || "";
    const match = cookies.match(/original_admin_openId=([^;]+)/);
    const isImpersonating = !!match;
    return {
      isImpersonating,
      currentUser: { id: ctx.user.id, name: ctx.user.name, email: ctx.user.email, role: ctx.user.role },
    };
  }),
});
