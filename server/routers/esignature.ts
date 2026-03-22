import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { getDb } from "../db";
const safe = (s: string) => String(s || "").replace(/'/g, "''");
import { TRPCError } from "@trpc/server";
import crypto from "crypto";

export const esignatureRouter = router({
  // Get contract with signature status
  getContract: protectedProcedure
    .input(z.object({ contractId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { vendorContracts } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const [contract] = await db.select().from(vendorContracts).where(eq(vendorContracts.id, input.contractId)).limit(1);
      if (!contract) throw new TRPCError({ code: "NOT_FOUND" });

      // Get signatures
      const sigs = await db.execute(`SELECT * FROM contractSignatures WHERE contractId = ${input.contractId}`);
      return { ...contract, signatures: (sigs as any)[0] || [] };
    }),

  // Send contract for signature
  sendForSignature: protectedProcedure
    .input(z.object({
      contractId: z.number(),
      signatories: z.array(z.object({
        name: z.string(),
        email: z.string().email(),
        role: z.string().optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "procurement_manager") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Create signature tokens for each signatory
      for (const sig of input.signatories) {
        const token = crypto.randomBytes(32).toString("hex");
        await db.execute(`
          INSERT INTO contractSignatures (contractId, signatoryName, signatoryEmail, signatoryRole, signatureToken, status)
          VALUES (${input.contractId}, '${sig.name.replace(/'/g, "''")}', '${sig.email}', '${(sig.role || "").replace(/'/g, "''")}', '${token}', 'pending')
        `);
      }

      // Update contract status
      await db.execute(`
        UPDATE vendorContracts 
        SET signatureStatus = 'pending_signature', 
            signatories = '${JSON.stringify(input.signatories)}',
            sentAt = NOW()
        WHERE id = ${input.contractId}
      `);

      return { success: true, message: `Contrat envoyé à ${input.signatories.length} signataire(s)` };
    }),

  // Get signature page (public - via token)
  getSignaturePage: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const result = await db.execute(`
        SELECT cs.*, vc.title, vc.contractNumber, vc.description, vc.startDate, vc.endDate, vc.totalValue
        FROM contractSignatures cs
        JOIN vendorContracts vc ON cs.contractId = vc.id
        WHERE cs.signatureToken = '${safe(input.token)}'
        LIMIT 1
      `);
      const rows = (result as any)[0];
      if (!rows || rows.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Lien de signature invalide ou expiré" });
      const sig = rows[0];
      if (sig.status === "signed") return { ...sig, alreadySigned: true };
      return { ...sig, alreadySigned: false };
    }),

  // Submit signature (public - via token)
  submitSignature: publicProcedure
    .input(z.object({
      token: z.string(),
      signatureData: z.string(), // base64 canvas data
      signatoryName: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Get signature record
      const result = await db.execute(`SELECT * FROM contractSignatures WHERE signatureToken = '${safe(input.token)}' LIMIT 1`);
      const rows = (result as any)[0];
      if (!rows || rows.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
      const sig = rows[0];
      if (sig.status === "signed") throw new TRPCError({ code: "BAD_REQUEST", message: "Déjà signé" });

      // Save signature
      await db.execute(`
        UPDATE contractSignatures 
        SET signatureData = '${input.signatureData.replace(/'/g, "''")}',
            status = 'signed',
            signedAt = NOW()
        WHERE signatureToken = '${safe(input.token)}'
      `);

      // Check if all signatories have signed
      const allResult = await db.execute(`SELECT COUNT(*) as total, SUM(status = 'signed') as signed FROM contractSignatures WHERE contractId = ${sig.contractId}`);
      const counts = (allResult as any)[0][0];

      if (counts.total === counts.signed) {
        await db.execute(`UPDATE vendorContracts SET signatureStatus = 'fully_signed', fullySignedAt = NOW() WHERE id = ${sig.contractId}`);
      } else {
        await db.execute(`UPDATE vendorContracts SET signatureStatus = 'partially_signed' WHERE id = ${sig.contractId}`);
      }

      return { success: true, message: "Signature enregistrée avec succès !" };
    }),

  // List contracts for current org
  listContracts: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const result = await db.execute(`
      SELECT vc.*, v.legalName as vendorName
      FROM vendorContracts vc
      JOIN vendors v ON vc.vendorId = v.id
      WHERE v.organizationId = ${ctx.user.organizationId}
      ORDER BY vc.createdAt DESC
    `);
    return (result as any)[0] || [];
  }),
});
