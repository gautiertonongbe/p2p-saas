import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";

const VENDOR_SESSION_COOKIE = "vendor_session";

async function hashPassword(password: string): Promise<string> {
  const { createRequire } = await import("module");
  const require = createRequire(import.meta.url);
  const bcrypt = require("bcryptjs");
  return bcrypt.hash(password, 10);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const { createRequire } = await import("module");
  const require = createRequire(import.meta.url);
  const bcrypt = require("bcryptjs");
  return bcrypt.compare(password, hash);
}

export const supplierPortalRouter = router({
  // Invite vendor user (admin creates account)
  inviteVendorUser: protectedProcedure
    .input(z.object({
      vendorId: z.number(),
      name: z.string().min(1),
      email: z.string().email(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "procurement_manager") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const tempPassword = Math.random().toString(36).slice(-8) + "V1!";
      const hashed = await hashPassword(tempPassword);

      await db.execute(`
        INSERT INTO vendorUsers (vendorId, organizationId, name, email, password, status)
        VALUES (${input.vendorId}, ${ctx.user.organizationId}, 
          '${input.name.replace(/'/g, "''")}', 
          '${input.email.toLowerCase()}', 
          '${hashed}', 'active')
        ON DUPLICATE KEY UPDATE name = '${input.name.replace(/'/g, "''")}', status = 'active'
      `);

      return { success: true, tempPassword, email: input.email };
    }),

  // Vendor login
  vendorLogin: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const result = await db.execute(`SELECT * FROM vendorUsers WHERE email = '${input.email.toLowerCase()}' AND status = 'active' LIMIT 1`);
      const rows = (result as any)[0];
      if (!rows || rows.length === 0) throw new TRPCError({ code: "UNAUTHORIZED", message: "Email ou mot de passe incorrect" });

      const vendorUser = rows[0];
      
      // First login — any password accepted, then save
      if (!vendorUser.password) {
        const hashed = await hashPassword(input.password);
        await db.execute(`UPDATE vendorUsers SET password = '${hashed}', lastSignedIn = NOW() WHERE id = ${vendorUser.id}`);
      } else {
        const valid = await verifyPassword(input.password, vendorUser.password);
        if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Email ou mot de passe incorrect" });
        await db.execute(`UPDATE vendorUsers SET lastSignedIn = NOW() WHERE id = ${vendorUser.id}`);
      }

      // Set vendor session cookie
      const cookieOptions = getSessionCookieOptions(ctx.req);
      const sessionData = JSON.stringify({ vendorUserId: vendorUser.id, vendorId: vendorUser.vendorId, organizationId: vendorUser.organizationId });
      const encoded = Buffer.from(sessionData).toString("base64url");
      ctx.res.cookie(VENDOR_SESSION_COOKIE, encoded, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      return { success: true, vendorUser: { id: vendorUser.id, name: vendorUser.name, email: vendorUser.email, vendorId: vendorUser.vendorId } };
    }),

  // Get current vendor session
  vendorMe: publicProcedure.query(async ({ ctx }) => {
    const cookies = ctx.req.headers.cookie || "";
    const rawMatch = cookies.match(new RegExp(`${VENDOR_SESSION_COOKIE}=([^;]+)`));
    const match = rawMatch ? [rawMatch[0], decodeURIComponent(rawMatch[1])] : null;
    if (!match) return null;
    try {
      const data = JSON.parse(Buffer.from(match[1], "base64url").toString());
      const db = await getDb();
      if (!db) return null;
      const result = await db.execute(`
        SELECT vu.*, v.legalName as vendorName, v.tradeName 
        FROM vendorUsers vu 
        JOIN vendors v ON vu.vendorId = v.id 
        WHERE vu.id = ${data.vendorUserId} AND vu.status = 'active' 
        LIMIT 1
      `);
      const rows = (result as any)[0];
      return rows?.[0] || null;
    } catch { return null; }
  }),

  // Vendor logout
  vendorLogout: publicProcedure.mutation(async ({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(VENDOR_SESSION_COOKIE, cookieOptions);
    return { success: true };
  }),

  // Get POs for vendor
  getVendorPOs: publicProcedure.query(async ({ ctx }) => {
    const cookies = ctx.req.headers.cookie || "";
    const rawMatch = cookies.match(new RegExp(`${VENDOR_SESSION_COOKIE}=([^;]+)`));
    const match = rawMatch ? [rawMatch[0], decodeURIComponent(rawMatch[1])] : null;
    if (!match) throw new TRPCError({ code: "UNAUTHORIZED" });
    const data = JSON.parse(Buffer.from(match[1], "base64url").toString());

    const db = await getDb();
    if (!db) return [];
    const result = await db.execute(`
      SELECT po.*, 
        (SELECT COUNT(*) FROM vendorInvoiceSubmissions WHERE poId = po.id) as submissionCount
      FROM purchaseOrders po
      WHERE po.vendorId = ${data.vendorId}
      AND po.organizationId = ${data.organizationId}
      AND po.status IN ('issued', 'confirmed', 'partially_received')
      ORDER BY po.createdAt DESC
    `);
    return (result as any)[0] || [];
  }),

  // Get submissions by vendor
  getVendorSubmissions: publicProcedure.query(async ({ ctx }) => {
    const cookies = ctx.req.headers.cookie || "";
    const rawMatch = cookies.match(new RegExp(`${VENDOR_SESSION_COOKIE}=([^;]+)`));
    const match = rawMatch ? [rawMatch[0], decodeURIComponent(rawMatch[1])] : null;
    if (!match) throw new TRPCError({ code: "UNAUTHORIZED" });
    const data = JSON.parse(Buffer.from(match[1], "base64url").toString());

    const db = await getDb();
    if (!db) return [];
    const result = await db.execute(`
      SELECT * FROM vendorInvoiceSubmissions
      WHERE vendorId = ${data.vendorId}
      ORDER BY createdAt DESC
    `);
    return (result as any)[0] || [];
  }),

  // Submit invoice (vendor)
  submitInvoice: publicProcedure
    .input(z.object({
      poId: z.number().optional(),
      invoiceNumber: z.string().min(1),
      invoiceDate: z.string(),
      dueDate: z.string().optional(),
      amount: z.number().positive(),
      taxAmount: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const cookies = ctx.req.headers.cookie || "";
      const rawMatch = cookies.match(new RegExp(`${VENDOR_SESSION_COOKIE}=([^;]+)`));
    const match = rawMatch ? [rawMatch[0], decodeURIComponent(rawMatch[1])] : null;
      if (!match) throw new TRPCError({ code: "UNAUTHORIZED" });
      const data = JSON.parse(Buffer.from(match[1], "base64url").toString());

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.execute(`
        INSERT INTO vendorInvoiceSubmissions 
          (vendorId, organizationId, poId, invoiceNumber, invoiceDate, dueDate, amount, taxAmount, notes, status)
        VALUES (
          ${data.vendorId}, ${data.organizationId},
          ${input.poId || 'NULL'},
          '${input.invoiceNumber.replace(/'/g, "''")}',
          '${input.invoiceDate}',
          ${input.dueDate ? `'${input.dueDate}'` : 'NULL'},
          ${input.amount},
          ${input.taxAmount || 0},
          '${(input.notes || "").replace(/'/g, "''")}',
          'submitted'
        )
      `);

      return { success: true, message: "Facture soumise avec succès ! Le service achats va examiner votre soumission." };
    }),

  // List vendor submissions (buyer side)
  listSubmissions: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const result = await db.execute(`
      SELECT vis.*, v.legalName as vendorName, po.orderNumber
      FROM vendorInvoiceSubmissions vis
      JOIN vendors v ON vis.vendorId = v.id
      LEFT JOIN purchaseOrders po ON vis.poId = po.id
      WHERE vis.organizationId = ${ctx.user.organizationId}
      ORDER BY vis.createdAt DESC
    `);
    return (result as any)[0] || [];
  }),

  // Review submission (buyer)
  reviewSubmission: protectedProcedure
    .input(z.object({
      submissionId: z.number(),
      action: z.enum(["accept", "reject"]),
      note: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const status = input.action === "accept" ? "accepted" : "rejected";
      await db.execute(`
        UPDATE vendorInvoiceSubmissions 
        SET status = '${status}', reviewedBy = ${ctx.user.id}, reviewedAt = NOW(),
            reviewNote = '${(input.note || "").replace(/'/g, "''")}'
        WHERE id = ${input.submissionId} AND organizationId = ${ctx.user.organizationId}
      `);

      // If accepted, create an actual invoice
      if (input.action === "accept") {
        const result = await db.execute(`SELECT * FROM vendorInvoiceSubmissions WHERE id = ${input.submissionId}`);
        const sub = (result as any)[0]?.[0];
        if (sub) {
          await db.execute(`
            INSERT INTO invoices (organizationId, invoiceNumber, vendorId, poId, invoiceDate, dueDate, amount, taxAmount, status, matchStatus)
            VALUES (${ctx.user.organizationId}, '${sub.invoiceNumber}', ${sub.vendorId}, 
              ${sub.poId || 'NULL'}, '${sub.invoiceDate}', ${sub.dueDate ? `'${sub.dueDate}'` : 'NULL'},
              ${sub.amount}, ${sub.taxAmount || 0}, 'pending', 'unmatched')
          `);
        }
      }

      return { success: true };
    }),
});
