import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { sdk } from "../_core/sdk";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { TRPCError } from "@trpc/server";

const ADMIN_COOKIE = "original_admin_openId";

function parseCookies(cookieHeader?: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  cookieHeader.split(";").forEach(pair => {
    const [key, ...vals] = pair.trim().split("=");
    if (key) result[key.trim()] = decodeURIComponent(vals.join("=").trim());
  });
  return result;
}

export const impersonateRouter = router({
  start: protectedProcedure
    .input(z.object({ targetUserId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Seuls les administrateurs peuvent utiliser cette fonctionnalité" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [target] = await db.select().from(users).where(eq(users.id, input.targetUserId)).limit(1);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Utilisateur introuvable" });
      if (target.id === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Impossible de s'imiter soi-même" });

      // Save original admin openId
      ctx.res.cookie(ADMIN_COOKIE, ctx.user.openId, {
        httpOnly: true,
        path: "/",
        maxAge: ONE_YEAR_MS / 1000,
        sameSite: "lax",
      });

      // Create session for target
      const sessionToken = await sdk.createSessionToken(target.openId, {
        name: target.name || target.email || "",
        expiresInMs: ONE_YEAR_MS,
      });

      ctx.res.cookie(COOKIE_NAME, sessionToken, {
        httpOnly: true,
        path: "/",
        maxAge: ONE_YEAR_MS / 1000,
        sameSite: "lax",
      });

      return { success: true };
    }),

  stop: protectedProcedure
    .mutation(async ({ ctx }) => {
      const cookies = parseCookies(ctx.req.headers.cookie);
      const adminOpenId = cookies[ADMIN_COOKIE];

      if (!adminOpenId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Pas d'impersonation active" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [admin] = await db.select().from(users).where(eq(users.openId, adminOpenId)).limit(1);
      if (!admin) throw new TRPCError({ code: "NOT_FOUND", message: "Compte admin introuvable" });

      const sessionToken = await sdk.createSessionToken(admin.openId, {
        name: admin.name || admin.email || "",
        expiresInMs: ONE_YEAR_MS,
      });

      ctx.res.cookie(COOKIE_NAME, sessionToken, {
        httpOnly: true,
        path: "/",
        maxAge: ONE_YEAR_MS / 1000,
        sameSite: "lax",
      });

      ctx.res.clearCookie(ADMIN_COOKIE, { path: "/" });

      return { success: true };
    }),

  listUsers: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") return [];
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

  status: protectedProcedure.query(async ({ ctx }) => {
    const cookies = parseCookies(ctx.req.headers.cookie);
    const isImpersonating = !!cookies[ADMIN_COOKIE];
    return {
      isImpersonating,
      currentUser: {
        id: ctx.user.id,
        name: ctx.user.name,
        email: ctx.user.email,
        role: ctx.user.role,
      },
    };
  }),
});
