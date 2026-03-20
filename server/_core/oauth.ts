/**
 * Simple email/password authentication — replaces the Manus OAuth system.
 * Uses bcrypt for password hashing and JWT for session tokens.
 */
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

export function registerOAuthRoutes(app: Express) {
  // ── Login endpoint ─────────────────────────────────────────────────────────
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Email et mot de passe requis" });
      return;
    }

    try {
      const database = await db.getDb();
      if (!database) {
        res.status(500).json({ error: "Database unavailable" });
        return;
      }

      const { users } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");

      // Find user by email
      const [user] = await database.select().from(users)
        .where(eq(users.email, email.toLowerCase().trim()))
        .limit(1);

      if (!user) {
        res.status(401).json({ error: "Email ou mot de passe incorrect" });
        return;
      }

      if (user.status === "disabled") {
        res.status(401).json({ error: "Compte désactivé. Contactez votre administrateur." });
        return;
      }

      // Check password using bcrypt
      const bcrypt = await import("bcryptjs");
      const passwordField = (user as any).password;

      if (!passwordField) {
        // No password set — allow login for migration, then set password
        res.status(401).json({ error: "Aucun mot de passe défini. Contactez votre administrateur." });
        return;
      }

      const valid = await bcrypt.compare(password, passwordField);
      if (!valid) {
        res.status(401).json({ error: "Email ou mot de passe incorrect" });
        return;
      }

      // Update last sign in
      await database.update(users)
        .set({ lastSignedIn: new Date() })
        .where(eq(users.id, user.id));

      // Create session JWT
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || user.email || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (error) {
      console.error("[Auth] Login failed", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ── Logout endpoint ────────────────────────────────────────────────────────
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    res.clearCookie(COOKIE_NAME);
    res.json({ success: true });
  });

  // ── Change password endpoint ───────────────────────────────────────────────
  app.post("/api/auth/change-password", async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body;

    try {
      const user = await sdk.authenticateRequest(req);
      if (!user) {
        res.status(401).json({ error: "Non authentifié" });
        return;
      }

      const database = await db.getDb();
      if (!database) { res.status(500).json({ error: "DB unavailable" }); return; }

      const { users } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const bcrypt = await import("bcryptjs");

      const [dbUser] = await database.select().from(users).where(eq(users.id, user.id)).limit(1);
      const passwordField = (dbUser as any).password;

      if (passwordField) {
        const valid = await bcrypt.compare(currentPassword, passwordField);
        if (!valid) {
          res.status(400).json({ error: "Mot de passe actuel incorrect" });
          return;
        }
      }

      if (!newPassword || newPassword.length < 8) {
        res.status(400).json({ error: "Le nouveau mot de passe doit avoir au moins 8 caractères" });
        return;
      }

      const hashed = await bcrypt.hash(newPassword, 12);
      await database.update(users).set({ password: hashed } as any).where(eq(users.id, user.id));

      res.json({ success: true });
    } catch (error) {
      console.error("[Auth] Change password failed", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ── Legacy OAuth callback (redirect to home) ───────────────────────────────
  app.get("/api/oauth/callback", (_req: Request, res: Response) => {
    res.redirect("/");
  });
}
