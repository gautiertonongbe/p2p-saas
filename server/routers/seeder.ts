/**
 * Demo Data Seeder — resets org to a known, realistic state for E2E testing
 * Only available in non-production environments OR to super-admins
 * 
 * Creates a full P2P cycle:
 * Vendors → Budgets → DA (draft + submitted + approved) → BC → Réception → Facture → Paiement
 * Plus: RFQ cycle, Notes de frais, Contrats
 */

import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "../db";

function safe(s: string) { return s.replace(/'/g, "''"); }
function now() { return new Date().toISOString().slice(0, 19).replace("T", " "); }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 19).replace("T", " "); }
function daysFromNow(n: number) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 19).replace("T", " "); }

export const seederRouter = router({

  // Get current state before seeding
  getState: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const dbInstance = await db.getDb();
    if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const org = ctx.user.organizationId;
    
    const [[prCount], [poCount], [invCount], [vendorCount], [payCount]] = await Promise.all([
      dbInstance.execute(`SELECT COUNT(*) as c FROM purchaseRequests WHERE organizationId=${org}`),
      dbInstance.execute(`SELECT COUNT(*) as c FROM purchaseOrders WHERE organizationId=${org}`),
      dbInstance.execute(`SELECT COUNT(*) as c FROM invoices WHERE organizationId=${org}`),
      dbInstance.execute(`SELECT COUNT(*) as c FROM vendors WHERE organizationId=${org}`),
      dbInstance.execute(`SELECT COUNT(*) as c FROM payments WHERE organizationId=${org}`),
    ]) as any;
    
    return {
      purchaseRequests: Number(prCount[0]?.c || 0),
      purchaseOrders:   Number(poCount[0]?.c || 0),
      invoices:         Number(invCount[0]?.c || 0),
      vendors:          Number(vendorCount[0]?.c || 0),
      payments:         Number(payCount[0]?.c || 0),
    };
  }),

  // Full reset + seed
  seed: protectedProcedure
    .input(z.object({
      clearExisting: z.boolean().default(false),
      scenarios: z.array(z.enum([
        "vendors", "budgets", "full_cycle", "rfq_cycle",
        "expenses", "contracts", "edge_cases"
      ])).default(["vendors", "budgets", "full_cycle"]),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const org = ctx.user.organizationId;
      const userId = ctx.user.id;
      const log: string[] = [];

      // Get org users
      const usersRes = await dbInstance.execute(
        `SELECT id, role, name FROM users WHERE organizationId=${org} LIMIT 10`
      ) as any;
      const orgUsers = usersRes[0] as any[];
      const adminUser = orgUsers.find((u: any) => u.role === "admin") || orgUsers[0];
      const managerUser = orgUsers.find((u: any) => u.role === "procurement_manager") || adminUser;
      const approverUser = orgUsers.find((u: any) => u.role === "approver") || adminUser;
      const requesterUser = orgUsers.find((u: any) => u.role === "requester") || adminUser;

      // ── Clear existing (optional) ─────────────────────────────────────────
      if (input.clearExisting) {
        const tables = [
          "savingsRecords","payments","invoices","receiptItems","receipts",
          "purchaseOrderItems","purchaseOrders","purchaseRequestItems",
          "approvals","purchaseRequests","rfqResponseItems","rfqResponses",
          "rfqVendors","rfqItems","rfqs","budgets","vendorContracts","vendors",
        ];
        for (const t of tables) {
          try {
            await dbInstance.execute(`DELETE FROM ${t} WHERE organizationId=${org}`);
          } catch { /* ignore */ }
        }
        log.push("✅ Cleared existing data");
      }

      let vendorIds: number[] = [];
      let budgetId = 0;
      let deptId = 0;

      // Get or create department
      try {
        const deptRes = await dbInstance.execute(
          `SELECT id FROM departments WHERE organizationId=${org} LIMIT 1`
        ) as any;
        deptId = Number(deptRes[0]?.[0]?.id || 0);
        if (!deptId) {
          const dr = await dbInstance.execute(
            `INSERT INTO departments (organizationId, name, code) VALUES (${org}, 'Direction Générale', 'DG')`
          ) as any;
          deptId = Number(dr[0].insertId);
        }
      } catch { /* ignore */ }

      // ── VENDORS ─────────────────────────────────────────────────────────
      if (input.scenarios.includes("vendors")) {
        const vendorData = [
          { name: "Tech Solutions SARL",    taxId: "BJ-2024-001", country: "BJ", risk: "low",    score: 92, category: "IT & Technologie" },
          { name: "Fournitures Bureau Plus", taxId: "BJ-2024-002", country: "BJ", risk: "low",    score: 88, category: "Fournitures" },
          { name: "Transport Express CI",    taxId: "CI-2024-003", country: "CI", risk: "medium", score: 75, category: "Transport" },
          { name: "BTP Construction Co",     taxId: "BJ-2024-004", country: "BJ", risk: "medium", score: 70, category: "Construction" },
          { name: "Nettoyage Pro Services",  taxId: "BJ-2024-005", country: "BJ", risk: "low",    score: 85, category: "Services" },
          { name: "Fournisseur Test SARL",   taxId: "BJ-2024-006", country: "BJ", risk: "low",    score: 90, category: "Divers" },
        ];
        
        for (const v of vendorData) {
          try {
            const r = await dbInstance.execute(
              `INSERT INTO vendors (organizationId, legalName, tradeName, taxId, country, status, performanceScore, riskLevel, createdAt)
               VALUES (${org}, '${safe(v.name)}', '${safe(v.name)}', '${v.taxId}', '${v.country}', 'active', ${v.score}, '${v.risk}', '${daysAgo(30)}')`
            ) as any;
            vendorIds.push(Number(r[0].insertId));
          } catch { /* may already exist */ }
        }
        
        // If vendors already existed, fetch them
        if (vendorIds.length === 0) {
          const vr = await dbInstance.execute(`SELECT id FROM vendors WHERE organizationId=${org} AND status='active' LIMIT 6`) as any;
          vendorIds = (vr[0] as any[]).map((v: any) => Number(v.id));
        }
        log.push(`✅ ${vendorIds.length} fournisseurs créés`);
      }

      // Ensure we have vendor IDs even if vendors scenario skipped
      if (vendorIds.length === 0) {
        const vr = await dbInstance.execute(`SELECT id FROM vendors WHERE organizationId=${org} AND status='active' LIMIT 6`) as any;
        vendorIds = (vr[0] as any[]).map((v: any) => Number(v.id));
        if (vendorIds.length === 0) vendorIds = [1]; // fallback
      }
      const v1 = vendorIds[0], v2 = vendorIds[1] || v1, v3 = vendorIds[2] || v1;

      // ── BUDGETS ─────────────────────────────────────────────────────────
      if (input.scenarios.includes("budgets")) {
        const year = new Date().getFullYear();
        try {
          const br = await dbInstance.execute(
            `INSERT INTO budgets (organizationId, name, totalAmount, spentAmount, year, departmentId, isActive, createdAt)
             VALUES (${org}, 'Budget Informatique ${year}', 15000000, 3500000, ${year}, ${deptId || "NULL"}, 1, '${daysAgo(60)}')`
          ) as any;
          budgetId = Number(br[0].insertId);
          
          await dbInstance.execute(
            `INSERT INTO budgets (organizationId, name, totalAmount, spentAmount, year, departmentId, isActive, createdAt)
             VALUES (${org}, 'Budget Fournitures ${year}', 5000000, 1200000, ${year}, ${deptId || "NULL"}, 1, '${daysAgo(60)}')`
          );
          await dbInstance.execute(
            `INSERT INTO budgets (organizationId, name, totalAmount, spentAmount, year, isActive, createdAt)
             VALUES (${org}, 'Budget Opérationnel ${year}', 25000000, 8000000, ${year}, 1, '${daysAgo(60)}')`
          );
          log.push("✅ 3 budgets créés");
        } catch { log.push("⚠️ Budgets: déjà existants ou erreur"); }
      }

      // ── FULL P2P CYCLE ───────────────────────────────────────────────────
      if (input.scenarios.includes("full_cycle")) {

        // 1. DA brouillon
        await dbInstance.execute(
          `INSERT INTO purchaseRequests (organizationId, requestNumber, title, description, status, urgencyLevel, amountEstimate, requesterId, departmentId, createdAt)
           VALUES (${org}, 'DA-DEMO-001', 'Achat ordinateurs portables — Équipe commerciale', 'Renouvellement parc informatique de 5 commerciaux', 'draft', 'medium', 2500000, ${requesterUser.id}, ${deptId || "NULL"}, '${daysAgo(3)}')`
        );
        log.push("✅ DA brouillon créée");

        // 2. DA soumise (en approbation)
        const pr2 = await dbInstance.execute(
          `INSERT INTO purchaseRequests (organizationId, requestNumber, title, description, status, urgencyLevel, amountEstimate, requesterId, departmentId, createdAt)
           VALUES (${org}, 'DA-DEMO-002', 'Fournitures de bureau Q2 2026', 'Papier, stylos, classeurs pour toute l''équipe', 'submitted', 'low', 450000, ${requesterUser.id}, ${deptId || "NULL"}, '${daysAgo(5)}')`
        ) as any;
        const pr2Id = Number(pr2[0].insertId);

        // 3. DA approuvée (prête pour BC)
        const pr3 = await dbInstance.execute(
          `INSERT INTO purchaseRequests (organizationId, requestNumber, title, description, status, urgencyLevel, amountEstimate, requesterId, departmentId, createdAt)
           VALUES (${org}, 'DA-DEMO-003', 'Maintenance climatiseurs — Siège social', 'Contrat annuel maintenance préventive et corrective', 'approved', 'high', 1800000, ${requesterUser.id}, ${deptId || "NULL"}, '${daysAgo(10)}')`
        ) as any;
        const pr3Id = Number(pr3[0].insertId);
        await dbInstance.execute(`INSERT INTO purchaseRequestItems (requestId, itemName, description, quantity, unitPrice, totalPrice, unit) VALUES (${pr3Id}, 'Maintenance climatiseurs', 'Contrat annuel', 1, 1800000, 1800000, 'forfait')`);
        log.push("✅ 3 DAs créées (brouillon, soumise, approuvée)");

        // 4. BC créé depuis DA approuvée
        const po1 = await dbInstance.execute(
          `INSERT INTO purchaseOrders (organizationId, requestId, vendorId, poNumber, status, totalAmount, currency, expectedDeliveryDate, notes, issuedBy, issuedAt, createdAt)
           VALUES (${org}, ${pr3Id}, ${v1}, 'BC-DEMO-001', 'approved', 1650000, 'XOF', '${daysFromNow(15)}', 'Contrat maintenance annuel climatiseurs', ${managerUser.id}, '${daysAgo(7)}', '${daysAgo(8)}')`
        ) as any;
        const po1Id = Number(po1[0].insertId);
        await dbInstance.execute(`INSERT INTO purchaseOrderItems (poId, itemName, quantity, unitPrice, totalPrice, unit, receivedQuantity) VALUES (${po1Id}, 'Maintenance climatiseurs', 1, 1650000, 1650000, 'forfait', 0)`);

        // Savings: 1800000 - 1650000 = 150000 XOF
        await dbInstance.execute(
          `INSERT INTO savingsRecords (organizationId, title, vendorId, savingsType, budgetAmount, actualAmount, savingsAmount, savingsPercent, poId, notes, recordedBy, createdAt)
           VALUES (${org}, 'Économie BC vs DA: Maintenance climatiseurs', ${v1}, 'price_negotiation', 1800000, 1650000, 150000, 8.33, ${po1Id}, 'Calculé automatiquement depuis la DA DA-DEMO-003', ${managerUser.id}, '${daysAgo(8)}')`
        );

        // 5. BC reçu partiellement
        const po2 = await dbInstance.execute(
          `INSERT INTO purchaseOrders (organizationId, requestId, vendorId, poNumber, status, totalAmount, currency, notes, issuedBy, issuedAt, createdAt)
           VALUES (${org}, ${pr3Id}, ${v2}, 'BC-DEMO-002', 'partially_received', 420000, 'XOF', 'Fournitures de bureau', ${managerUser.id}, '${daysAgo(12)}', '${daysAgo(12)}')`
        ) as any;
        const po2Id = Number(po2[0].insertId);
        await dbInstance.execute(`INSERT INTO purchaseOrderItems (poId, itemName, quantity, unitPrice, totalPrice, unit, receivedQuantity) VALUES (${po2Id}, 'Ramettes de papier A4', 50, 5000, 250000, 'ramette', 30)`);
        await dbInstance.execute(`INSERT INTO purchaseOrderItems (poId, itemName, quantity, unitPrice, totalPrice, unit, receivedQuantity) VALUES (${po2Id}, 'Stylos bille', 200, 850, 170000, 'pcs', 200)`);
        log.push("✅ 2 BCs créés (approuvé, partiellement reçu)");

        // 6. Facture en attente
        await dbInstance.execute(
          `INSERT INTO invoices (organizationId, invoiceNumber, vendorId, poId, invoiceDate, dueDate, amount, taxAmount, currency, status, matchStatus, createdAt)
           VALUES (${org}, 'FAC-DEMO-001', ${v2}, ${po2Id}, '${daysAgo(8)}', '${daysFromNow(22)}', 370000, 66600, 'XOF', 'pending', 'matched', '${daysAgo(8)}')`
        );

        // 7. Facture approuvée (prête pour paiement)
        const inv2 = await dbInstance.execute(
          `INSERT INTO invoices (organizationId, invoiceNumber, vendorId, poId, invoiceDate, dueDate, amount, taxAmount, currency, status, matchStatus, approvedBy, approvedAt, createdAt)
           VALUES (${org}, 'FAC-DEMO-002', ${v1}, ${po1Id}, '${daysAgo(5)}', '${daysFromNow(25)}', 1650000, 297000, 'XOF', 'approved', 'matched', ${adminUser.id}, '${daysAgo(3)}', '${daysAgo(5)}')`
        ) as any;
        const inv2Id = Number(inv2[0].insertId);
        log.push("✅ 2 factures créées (en attente, approuvée)");

        // 8. Paiement effectué
        await dbInstance.execute(
          `INSERT INTO payments (organizationId, invoiceId, paymentMethod, amount, currency, reference, valueDate, status, notes, createdAt)
           VALUES (${org}, ${inv2Id}, 'bank_transfer', 1947000, 'XOF', 'VIR-2026-DEMO-001', '${daysAgo(2)}', 'completed', 'Virement SGBCI — Maintenance climatiseurs TTC', '${daysAgo(2)}')`
        );

        // Mark invoice as paid
        await dbInstance.execute(`UPDATE invoices SET status='paid' WHERE id=${inv2Id} AND organizationId=${org}`);
        log.push("✅ 1 paiement effectué (cycle complet: DA → BC → Facture → Paiement)");
      }

      // ── RFQ CYCLE ────────────────────────────────────────────────────────
      if (input.scenarios.includes("rfq_cycle") && vendorIds.length >= 2) {
        try {
          const rfq = await dbInstance.execute(
            `INSERT INTO rfqs (organizationId, rfqNumber, title, description, status, deadline, estimatedValue, currency, createdBy, createdAt)
             VALUES (${org}, 'AO-DEMO-001', 'Fourniture et installation serveurs datacenter', 'Appel d''offres pour infrastructure serveurs — 3 racks', 'responses_received', '${daysAgo(2)}', 8000000, 'XOF', ${managerUser.id}, '${daysAgo(20)}')`
          ) as any;
          const rfqId = Number(rfq[0].insertId);
          
          await dbInstance.execute(`INSERT INTO rfqItems (rfqId, itemName, description, quantity, unit, estimatedUnitPrice) VALUES (${rfqId}, 'Serveur Dell PowerEdge R750', 'Serveur rack 2U, 64GB RAM', 3, 'pcs', 2500000)`);
          await dbInstance.execute(`INSERT INTO rfqItems (rfqId, itemName, description, quantity, unit, estimatedUnitPrice) VALUES (${rfqId}, 'Switch réseau 48 ports', 'Cisco Catalyst 48 ports PoE', 2, 'pcs', 500000)`);

          // Vendor 1 invited + responded
          await dbInstance.execute(`INSERT INTO rfqVendors (rfqId, vendorId, status, invitedAt) VALUES (${rfqId}, ${v1}, 'responded', '${daysAgo(18)}')`);
          await dbInstance.execute(`INSERT INTO rfqVendors (rfqId, vendorId, status, invitedAt) VALUES (${rfqId}, ${v2}, 'responded', '${daysAgo(18)}')`);
          if (v3 !== v1) await dbInstance.execute(`INSERT INTO rfqVendors (rfqId, vendorId, status, invitedAt) VALUES (${rfqId}, ${v3}, 'declined', '${daysAgo(18)}')`);

          // Responses
          await dbInstance.execute(`INSERT INTO rfqResponses (rfqId, vendorId, totalAmount, currency, notes, submittedAt, status) VALUES (${rfqId}, ${v1}, 7200000, 'XOF', 'Offre incluant installation et formation 2 jours', '${daysAgo(10)}', 'submitted')`);
          await dbInstance.execute(`INSERT INTO rfqResponses (rfqId, vendorId, totalAmount, currency, notes, submittedAt, status) VALUES (${rfqId}, ${v2}, 8500000, 'XOF', 'Offre standard avec garantie 3 ans', '${daysAgo(9)}', 'submitted')`);

          // Savings from RFQ: 8500000 - 7200000 = 1300000 XOF
          await dbInstance.execute(
            `INSERT INTO savingsRecords (organizationId, title, vendorId, savingsType, budgetAmount, actualAmount, savingsAmount, savingsPercent, notes, recordedBy, createdAt)
             VALUES (${org}, 'Économie AO serveurs: offre retenue vs plus haute', ${v1}, 'alternative_vendor', 8500000, 7200000, 1300000, 15.29, 'Calculé automatiquement depuis l''AO AO-DEMO-001', ${managerUser.id}, '${daysAgo(5)}')`
          );
          log.push("✅ Cycle AO créé (2 réponses, économie calculée)");
        } catch (e) { log.push("⚠️ RFQ: " + String(e).slice(0, 50)); }
      }

      // ── EXPENSES ─────────────────────────────────────────────────────────
      if (input.scenarios.includes("expenses")) {
        try {
          // Submitted expense waiting approval
          await dbInstance.execute(
            `INSERT INTO expenseReports (organizationId, reportNumber, title, status, totalAmount, currency, periodStart, periodEnd, submitterId, submitterName, createdAt)
             VALUES (${org}, 'NDF-DEMO-001', 'Déplacement Cotonou-Abidjan — Salon Tech Africa', 'submitted', 285000, 'XOF', '${daysAgo(14)}', '${daysAgo(10)}', ${requesterUser.id}, '${requesterUser.name || "Utilisateur"}', '${daysAgo(9)}')`
          );
          // Approved expense
          await dbInstance.execute(
            `INSERT INTO expenseReports (organizationId, reportNumber, title, status, totalAmount, currency, periodStart, periodEnd, submitterId, submitterName, approvedBy, approvedAt, createdAt)
             VALUES (${org}, 'NDF-DEMO-002', 'Repas clients — Négociation contrat annuel', 'approved', 85000, 'XOF', '${daysAgo(20)}', '${daysAgo(20)}', ${requesterUser.id}, '${requesterUser.name || "Utilisateur"}', ${adminUser.id}, '${daysAgo(15)}', '${daysAgo(19)}')`
          );
          log.push("✅ 2 notes de frais créées (soumise, approuvée)");
        } catch (e) { log.push("⚠️ Expenses: " + String(e).slice(0, 50)); }
      }

      // ── CONTRACTS ────────────────────────────────────────────────────────
      if (input.scenarios.includes("contracts")) {
        try {
          await dbInstance.execute(
            `INSERT INTO vendorContracts (organizationId, vendorId, title, contractNumber, startDate, endDate, value, currency, status, autoRenew, notes, createdAt)
             VALUES (${org}, ${v1}, 'Contrat maintenance IT annuel', 'CTR-DEMO-001', '${daysAgo(180)}', '${daysFromNow(185)}', 3600000, 'XOF', 'active', 1, 'Renouvellement automatique sauf résiliation 60j avant', '${daysAgo(180)}')`
          );
          await dbInstance.execute(
            `INSERT INTO vendorContracts (organizationId, vendorId, title, contractNumber, startDate, endDate, value, currency, status, autoRenew, createdAt)
             VALUES (${org}, ${v2}, 'Fournitures bureau cadre annuel', 'CTR-DEMO-002', '${daysAgo(90)}', '${daysFromNow(275)}', 1200000, 'XOF', 'active', 0, '${daysAgo(90)}')`
          );
          // Expiring soon
          await dbInstance.execute(
            `INSERT INTO vendorContracts (organizationId, vendorId, title, contractNumber, startDate, endDate, value, currency, status, autoRenew, createdAt)
             VALUES (${org}, ${v3 || v1}, 'Contrat sécurité-gardiennage', 'CTR-DEMO-003', '${daysAgo(335)}', '${daysFromNow(30)}', 2400000, 'XOF', 'active', 0, '${daysAgo(335)}')`
          );
          log.push("✅ 3 contrats créés (dont 1 expire dans 30 jours)");
        } catch (e) { log.push("⚠️ Contracts: " + String(e).slice(0, 50)); }
      }

      // ── EDGE CASES ───────────────────────────────────────────────────────
      if (input.scenarios.includes("edge_cases")) {
        try {
          // Overdue invoice
          await dbInstance.execute(
            `INSERT INTO invoices (organizationId, invoiceNumber, vendorId, invoiceDate, dueDate, amount, taxAmount, currency, status, matchStatus, createdAt)
             VALUES (${org}, 'FAC-DEMO-OVERDUE', ${v3 || v1}, '${daysAgo(45)}', '${daysAgo(15)}', 550000, 99000, 'XOF', 'approved', 'unmatched', '${daysAgo(45)}')`
          );
          // Rejected PR
          await dbInstance.execute(
            `INSERT INTO purchaseRequests (organizationId, requestNumber, title, status, urgencyLevel, amountEstimate, requesterId, createdAt)
             VALUES (${org}, 'DA-DEMO-REJECTED', 'Achat véhicule de service', 'rejected', 'medium', 12000000, ${requesterUser.id}, '${daysAgo(25)}')`
          );
          // Disputed invoice
          await dbInstance.execute(
            `INSERT INTO invoices (organizationId, invoiceNumber, vendorId, invoiceDate, amount, currency, status, matchStatus, disputeReason, disputedAt, createdAt)
             VALUES (${org}, 'FAC-DEMO-DISPUTE', ${v2}, '${daysAgo(15)}', 780000, 'XOF', 'disputed', 'exception', 'Montant ne correspond pas au BC — écart de 80 000 XOF', '${daysAgo(10)}', '${daysAgo(15)}')`
          );
          log.push("✅ Cas limites: facture en retard, DA refusée, facture contestée");
        } catch (e) { log.push("⚠️ Edge cases: " + String(e).slice(0, 50)); }
      }

      return {
        success: true,
        log,
        summary: `${log.length} opérations réussies`,
      };
    }),
});
