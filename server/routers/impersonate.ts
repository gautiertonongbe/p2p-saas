import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const ADMIN_COOKIE = "p2p_admin_openid";

function parseCookies(cookieHeader?: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  cookieHeader.split(";").forEach(pair => {
    const idx = pair.indexOf("=");
    if (idx < 0) return;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    try { result[key] = decodeURIComponent(val); } catch { result[key] = val; }
  });
  return result;
}

async function createSession(res: any, openId: string, name: string) {
  // Use the same cookie name as the main auth system
  const { COOKIE_NAME, ONE_YEAR_MS } = await import("@shared/const");
  const { sdk } = await import("../_core/sdk");
  const token = await sdk.createSessionToken(openId, {
    name,
    expiresInMs: ONE_YEAR_MS,
  });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    path: "/",
    maxAge: ONE_YEAR_MS / 1000,
    sameSite: "lax",
  });
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

      // Save admin openId in a separate cookie
      const { ONE_YEAR_MS } = await import("@shared/const");
      ctx.res.cookie(ADMIN_COOKIE, ctx.user.openId, {
        httpOnly: true,
        path: "/",
        maxAge: ONE_YEAR_MS / 1000,
        sameSite: "lax",
      });

      await createSession(ctx.res, target.openId, target.name || target.email || "");
      return { success: true };
    }),

  stop: protectedProcedure
    .mutation(async ({ ctx }) => {
      const cookies = parseCookies(ctx.req.headers.cookie);
      const adminOpenId = cookies[ADMIN_COOKIE];
      if (!adminOpenId) throw new TRPCError({ code: "BAD_REQUEST", message: "Pas d'impersonation active" });

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [admin] = await db.select().from(users).where(eq(users.openId, adminOpenId)).limit(1);
      if (!admin) throw new TRPCError({ code: "NOT_FOUND", message: "Compte admin introuvable" });

      ctx.res.clearCookie(ADMIN_COOKIE, { path: "/" });
      await createSession(ctx.res, admin.openId, admin.name || admin.email || "");
      return { success: true };
    }),

  listUsers: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") return [];
    const db = await getDb();
    if (!db) return [];
    const all = await db.select({
      id: users.id, name: users.name, email: users.email,
      role: users.role, status: users.status,
    }).from(users).where(eq(users.organizationId, ctx.user.organizationId));
    return all.filter(u => u.id !== ctx.user.id);
  }),

  status: protectedProcedure.query(async ({ ctx }) => {
    const cookies = parseCookies(ctx.req.headers.cookie);
    const isImpersonating = !!(cookies[ADMIN_COOKIE]);
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
