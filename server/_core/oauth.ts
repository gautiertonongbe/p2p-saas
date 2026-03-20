import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePassword(password: string, stored: string): Promise<boolean> {
  try {
    // Handle bcrypt hashes (starts with $2)
    if (stored.startsWith("$2")) {
      // Use dynamic import for bcryptjs
      const { default: bcrypt } = await import("bcryptjs") as any;
      if (bcrypt && typeof bcrypt.compare === "function") {
        return bcrypt.compare(password, stored);
      }
      // Fallback: try compare from named export
      const mod = await import("bcryptjs") as any;
      const compareFn = mod.compare || mod.default?.compare;
      if (compareFn) return compareFn(password, stored);
      return false;
    }
    // Handle scrypt hashes (our new format)
    const [hashedPassword, salt] = stored.split(".");
    if (!hashedPassword || !salt) return false;
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    const storedBuf = Buffer.from(hashedPassword, "hex");
    return timingSafeEqual(buf, storedBuf);
  } catch (e) {
    console.error("[Auth] comparePassword error:", e);
    return false;
  }
}

export function registerOAuthRoutes(app: Express) {
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Email et mot de passe requis" });
      return;
    }

    try {
      const database = await db.getDb();
      if (!database) {
        res.status(500).json({ error: "Base de données indisponible" });
        return;
      }

      const [user] = await database.select().from(users)
        .where(eq(users.email, email.toLowerCase().trim()))
        .limit(1);

      if (!user) {
        res.status(401).json({ error: "Email ou mot de passe incorrect" });
        return;
      }

      if (user.status === "disabled") {
        res.status(401).json({ error: "Compte désactivé" });
        return;
      }

      const passwordField = (user as any).password;
      if (!passwordField) {
        // No password set — set it now and log in
        const hashed = await hashPassword(password);
        await database.update(users).set({ password: hashed } as any).where(eq(users.id, user.id));
      } else {
        const valid = await comparePassword(password, passwordField);
        if (!valid) {
          res.status(401).json({ error: "Email ou mot de passe incorrect" });
          return;
        }
      }

      await database.update(users)
        .set({ lastSignedIn: new Date() })
        .where(eq(users.id, user.id));

      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || user.email || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (error) {
      console.error("[Auth] Login failed:", error);
      res.status(500).json({ error: "Erreur serveur: " + String(error) });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    res.clearCookie(COOKIE_NAME);
    res.json({ success: true });
  });

  app.post("/api/auth/update-profile", async (req: Request, res: Response) => {
    try {
      const sessionToken = req.cookies?.[COOKIE_NAME];
      if (!sessionToken) return res.status(401).json({ error: "Non authentifié" });
      const session = await sdk.getSession(sessionToken);
      if (!session?.userId) return res.status(401).json({ error: "Session invalide" });
      const { name } = req.body;
      if (!name?.trim()) return res.status(400).json({ error: "Nom requis" });
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return res.status(500).json({ error: "DB error" });
      const { users } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db.update(users).set({ name: name.trim() }).where(eq(users.openId, session.userId));
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/oauth/callback", (_req: Request, res: Response) => {
    res.redirect("/");
  });
}
