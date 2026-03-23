/**
 * Demo Data Seeder — resets org to a known, realistic state for E2E testing
 * Admin only. Idempotent — uses unique request numbers to avoid duplicates.
 */
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "../db";

const safe = (s: string) => s.replace(/'/g, "''");
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 19).replace("T", " "); };
const daysFromNow = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 19).replace("T", " "); };

export const seederRouter = router({

  getState: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const dbI = await db.getDb();
    if (!dbI) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const org = ctx.user.organizationId;
    const run = async (sql: string) => { const r = await dbI.execute(sql) as any; return Number(r[0]?.[0]?.c || 0); };
    return {
      purchaseRequests: await run(`SELECT COUNT(*) as c FROM purchaseRequests WHERE organizationId=${org}`),
      purchaseOrders:   await run(`SELECT COUNT(*) as c FROM purchaseOrders WHERE organizationId=${org}`),
      invoices:         await run(`SELECT COUNT(*) as c FROM invoices WHERE organizationId=${org}`),
      vendors:          await run(`SELECT COUNT(*) as c FROM vendors WHERE organizationId=${org}`),
      payments:         await run(`SELECT COUNT(*) as c FROM payments WHERE organizationId=${org}`),
    };
  }),

  seed: protectedProcedure
    .input(z.object({
      clearExisting: z.boolean().default(false),
      scenarios: z.array(z.enum(["vendors","budgets","full_cycle","rfq_cycle","expenses","contracts","edge_cases"])).default(["vendors","budgets","full_cycle"]),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const dbI = await db.getDb();
      if (!dbI) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const org = ctx.user.organizationId;
      const log: string[] = [];

      // Get org users
      const usersRes = await dbI.execute(`SELECT id, role, name FROM users WHERE organizationId=${org} LIMIT 10`) as any;
      const orgUsers = usersRes[0] as any[];
      const admin     = orgUsers.find((u: any) => u.role === "admin") || orgUsers[0];
      const manager   = orgUsers.find((u: any) => u.role === "procurement_manager") || admin;
      const requester = orgUsers.find((u: any) => u.role === "requester") || admin;

      // Get or create a department for linking
      let deptId: number | null = null;
      try {
        const dr = await dbI.execute(`SELECT id FROM departments WHERE organizationId=${org} LIMIT 1`) as any;
        deptId = dr[0]?.[0]?.id ? Number(dr[0][0].id) : null;
        if (!deptId) {
          const nr = await dbI.execute(`INSERT INTO departments (organizationId, name, code) VALUES (${org}, 'Direction Générale', 'DG')`) as any;
          deptId = Number(nr[0].insertId);
        }
      } catch { /* ignore */ }

      // ── CLEAR ──────────────────────────────────────────────────────────────
      if (input.clearExisting) {
        const tables = ["savingsRecords","payments","invoices","receiptItems","receipts",
          "purchaseOrderItems","purchaseOrders","purchaseRequestItems","approvals",
          "purchaseRequests","rfqResponseItems","rfqResponses","rfqVendors","rfqItems","rfqs",
          "vendorContracts","vendors"];
        for (const t of tables) {
          try { await dbI.execute(`DELETE FROM ${t} WHERE organizationId=${org}`); } catch { /* ignore */ }
        }
        try { await dbI.execute(`DELETE FROM budgets WHERE organizationId=${org}`); } catch { /* ignore */ }
        try { await dbI.execute(`DELETE FROM expenseReports WHERE organizationId=${org}`); } catch { /* ignore */ }
        // Clear approval policies and steps
        try {
          const pIds = await dbI.execute(`SELECT id FROM approvalPolicies WHERE organizationId=${org}`) as any;
          const ids = (pIds[0] as any[]).map((p:any) => p.id);
          if (ids.length > 0) {
            await dbI.execute(`DELETE FROM approvalSteps WHERE policyId IN (${ids.join(",")})`);
          }
          await dbI.execute(`DELETE FROM approvalPolicies WHERE organizationId=${org}`);
        } catch { /* ignore */ }
        log.push("✅ Données existantes supprimées");
      }

      let vendorIds: number[] = [];

      // ── VENDORS ────────────────────────────────────────────────────────────
      if (input.scenarios.includes("vendors")) {
        const vendorList = [
          ["Tech Solutions SARL",     "BJ-DEMO-001", "BJ", "low",    92],
          ["Fournitures Bureau Plus",  "BJ-DEMO-002", "BJ", "low",    88],
          ["Transport Express CI",     "CI-DEMO-003", "CI", "medium", 75],
          ["BTP Construction Co",      "BJ-DEMO-004", "BJ", "medium", 70],
          ["Nettoyage Pro Services",   "BJ-DEMO-005", "BJ", "low",    85],
          ["Fournisseur Test SARL",    "BJ-DEMO-006", "BJ", "low",    90],
        ];
        for (const [name, taxId, country, risk, score] of vendorList) {
          try {
            const r = await dbI.execute(
              `INSERT INTO vendors (organizationId, legalName, tradeName, taxId, country, status, performanceScore, riskLevel, createdAt)
               VALUES (${org}, '${safe(String(name))}', '${safe(String(name))}', '${taxId}', '${country}', 'active', ${score}, '${risk}', '${daysAgo(30)}')`
            ) as any;
            vendorIds.push(Number(r[0].insertId));
          } catch { /* already exists */ }
        }
        if (vendorIds.length === 0) {
          const vr = await dbI.execute(`SELECT id FROM vendors WHERE organizationId=${org} AND status='active' LIMIT 6`) as any;
          vendorIds = (vr[0] as any[]).map((v: any) => Number(v.id));
        }
        log.push(`✅ ${vendorIds.length} fournisseurs créés`);
      }

      // Ensure vendor IDs available for other scenarios
      if (vendorIds.length === 0) {
        const vr = await dbI.execute(`SELECT id FROM vendors WHERE organizationId=${org} AND status='active' LIMIT 6`) as any;
        vendorIds = (vr[0] as any[]).map((v: any) => Number(v.id));
      }
      const [v1, v2, v3] = vendorIds.length >= 3
        ? vendorIds : [vendorIds[0] || 1, vendorIds[0] || 1, vendorIds[0] || 1];

      // ── BUDGETS ────────────────────────────────────────────────────────────
      if (input.scenarios.includes("budgets") && deptId) {
        const year = new Date().getFullYear();
        const period = `${year}`;
        try {
          // budgets schema: scopeType, scopeId, fiscalPeriod, allocatedAmount
          await dbI.execute(
            `INSERT INTO budgets (organizationId, scopeType, scopeId, fiscalPeriod, allocatedAmount, committedAmount, actualAmount, currency)
             VALUES (${org}, 'department', ${deptId}, '${period}', 15000000, 3500000, 2800000, 'XOF')`
          );
          await dbI.execute(
            `INSERT INTO budgets (organizationId, scopeType, scopeId, fiscalPeriod, allocatedAmount, committedAmount, actualAmount, currency)
             VALUES (${org}, 'department', ${deptId}, '${period}-Q1', 5000000, 1200000, 900000, 'XOF')`
          );
          log.push("✅ 2 budgets créés");
        } catch (e) { log.push(`⚠️ Budgets: ${String(e).slice(0, 60)}`); }
      }



      // ── 5 DEMO WORKFLOWS ─────────────────────────────────────────────────
      try {
        // Clear existing policies for clean demo
        const existingP = await dbI.execute(
          `SELECT id FROM approvalPolicies WHERE organizationId=${org}`
        ) as any;
        const existingIds = (existingP[0] as any[]).map((p: any) => p.id);
        if (existingIds.length > 0) {
          await dbI.execute(`DELETE FROM approvalSteps WHERE policyId IN (${existingIds.join(",")})`);
          await dbI.execute(`DELETE FROM approvalPolicies WHERE organizationId=${org}`);
        }

        const createPolicy = async (name: string, description: string, priority: number, conditions: any) => {
          const condStr = Object.keys(conditions).length === 0
            ? "NULL"
            : `'${JSON.stringify(conditions).replace(/'/g, "\'\'")}' `;
          const r = await dbI.execute(
            `INSERT INTO approvalPolicies (organizationId, name, description, isActive, priority, conditions)
             VALUES (${org}, '${name.replace(/'/g,"\'")}', '${description.replace(/'/g,"\'")}', 1, ${priority}, ${condStr})`
          ) as any;
          return Number(r[0].insertId);
        };
        const addStep = async (policyId: number, stepOrder: number, approverType: string, approverId: number) => {
          await dbI.execute(
            `INSERT INTO approvalSteps (policyId, stepOrder, approverType, approverId, isParallel)
             VALUES (${policyId}, ${stepOrder}, '${approverType}', ${approverId}, 0)`
          );
        };

        // Workflow 1: Petits achats ≤ 500 000 XOF → Manager uniquement
        const p1 = await createPolicy(
          "Petits achats",
          "Demandes jusqu\'à 500 000 XOF — approbation manager seul",
          10,
          { maxAmount: 500000 }
        );
        await addStep(p1, 1, "role", 2); // procurement_manager

        // Workflow 2: Achats moyens 500 001 – 2 000 000 XOF → Approbateur puis Manager
        const p2 = await createPolicy(
          "Achats moyens",
          "De 500 001 à 2 000 000 XOF — double validation",
          8,
          { minAmount: 500001, maxAmount: 2000000 }
        );
        await addStep(p2, 1, "role", 3); // approver first
        await addStep(p2, 2, "role", 2); // then manager

        // Workflow 3: Grands achats > 2 000 000 XOF → 3 niveaux
        const p3 = await createPolicy(
          "Grands achats",
          "Au-dessus de 2 000 000 XOF — triple validation obligatoire",
          6,
          { minAmount: 2000001 }
        );
        await addStep(p3, 1, "role", 3); // approver
        await addStep(p3, 2, "role", 2); // manager
        await addStep(p3, 3, "role", 1); // admin (DG)

        // Workflow 4: Urgences critiques → Admin direct (bypass approbateur)
        const p4 = await createPolicy(
          "Urgences critiques",
          "Toute demande critique — escalade directe vers la direction",
          9,
          { urgencyLevels: ["critical"] }
        );
        await addStep(p4, 1, "role", 1); // admin directly

        // Workflow 5: Catch-all → Approbateur seul
        const p5 = await createPolicy(
          "Politique par défaut",
          "Toutes les autres demandes — approbateur désigné",
          1,
          {} // null conditions = catch-all
        );
        await addStep(p5, 1, "role", 3); // approver

        log.push("✅ 5 workflows créés:");
        log.push("   1. Petits achats (≤ 500K) → Manager");
        log.push("   2. Achats moyens (500K–2M) → Approbateur → Manager");
        log.push("   3. Grands achats (> 2M) → Approbateur → Manager → Admin");
        log.push("   4. Urgences critiques → Admin direct");
        log.push("   5. Politique par défaut → Approbateur");
      } catch (e) { log.push(`⚠️ Workflows: ${String(e).slice(0, 80)}`); }


      // ── FULL P2P CYCLE ─────────────────────────────────────────────────────
      if (input.scenarios.includes("full_cycle")) {
        try {
          // 1. DA brouillon
          await dbI.execute(
            `INSERT INTO purchaseRequests (organizationId, requestNumber, requesterId, title, status, urgencyLevel, amountEstimate, currency, createdAt)
             VALUES (${org}, 'DA-SEED-001', ${requester.id}, 'Achat ordinateurs portables', 'draft', 'medium', 2500000, 'XOF', '${daysAgo(3)}')`
          );

          // 2. DA soumise
          await dbI.execute(
            `INSERT INTO purchaseRequests (organizationId, requestNumber, requesterId, title, status, urgencyLevel, amountEstimate, currency, createdAt)
             VALUES (${org}, 'DA-SEED-002', ${requester.id}, 'Fournitures de bureau Q2 2026', 'submitted', 'low', 450000, 'XOF', '${daysAgo(5)}')`
          );

          // 3. DA approuvée
          const pr3 = await dbI.execute(
            `INSERT INTO purchaseRequests (organizationId, requestNumber, requesterId, title, status, urgencyLevel, amountEstimate, currency, createdAt)
             VALUES (${org}, 'DA-SEED-003', ${requester.id}, 'Maintenance climatiseurs', 'approved', 'high', 1800000, 'XOF', '${daysAgo(10)}')`
          ) as any;
          const pr3Id = Number(pr3[0].insertId);
          await dbI.execute(
            `INSERT INTO purchaseRequestItems (requestId, itemName, quantity, unitPrice, totalPrice, unit)
             VALUES (${pr3Id}, 'Maintenance climatiseurs', 1, 1800000, 1800000, 'forfait')`
          );
          log.push("✅ 3 DAs créées (brouillon, soumise, approuvée)");
          // Create approval records for DA-SEED-002 (submitted) so approver has work
          try {
            const pr2Res = await dbI.execute(
              `SELECT id FROM purchaseRequests WHERE requestNumber='DA-SEED-002' AND organizationId=${org} LIMIT 1`
            ) as any;
            const pr2Id = pr2Res[0]?.[0]?.id;
            if (pr2Id) {
              // Get approver user ID
              const approverRes = await dbI.execute(
                `SELECT id FROM users WHERE organizationId=${org} AND role='approver' LIMIT 1`
              ) as any;
              const approverId = approverRes[0]?.[0]?.id;
              if (approverId) {
                await dbI.execute(
                  `INSERT INTO approvals (requestId, stepOrder, approverId, decision, createdAt)
                   VALUES (${pr2Id}, 1, ${approverId}, 'pending', '${daysAgo(4)}')`
                );
                await dbI.execute(
                  `UPDATE purchaseRequests SET status='pending_approval' WHERE id=${pr2Id} AND organizationId=${org}`
                );
                log.push("✅ Approbation créée pour DA-SEED-002 (approbateur assigné)");
              }
            }
          } catch (e2) { /* non-blocking */ }


          // 4. BC approuvé (négocié à 1 650 000 vs 1 800 000 estimé)
          const ts = Date.now().toString().slice(-8);
          const po1 = await dbI.execute(
            `INSERT INTO purchaseOrders (organizationId, requestId, vendorId, poNumber, status, totalAmount, currency, expectedDeliveryDate, notes, issuedAt, createdAt)
             VALUES (${org}, ${pr3Id}, ${v1}, 'BC-SEED-${ts}', 'approved', 1650000, 'XOF', '${daysFromNow(15)}', 'Contrat maintenance annuel climatiseurs', '${daysAgo(7)}', '${daysAgo(8)}')`
          ) as any;
          const po1Id = Number(po1[0].insertId);
          await dbI.execute(
            `INSERT INTO purchaseOrderItems (poId, itemName, quantity, unitPrice, totalPrice, unit, receivedQuantity)
             VALUES (${po1Id}, 'Maintenance climatiseurs', 1, 1650000, 1650000, 'forfait', 0)`
          );

          // Auto-savings: 1 800 000 - 1 650 000 = 150 000 XOF
          try {
            await dbI.execute(
              `INSERT INTO savingsRecords (organizationId, title, vendorId, savingsType, budgetAmount, actualAmount, savingsAmount, savingsPercent, poId, notes, recordedBy, createdAt)
               VALUES (${org}, 'Économie BC vs DA: Maintenance climatiseurs', ${v1}, 'price_negotiation', 1800000, 1650000, 150000, 8.33, ${po1Id}, 'Calcule automatiquement depuis la DA DA-SEED-003', ${manager.id}, '${daysAgo(7)}')`
            );
          } catch { /* savings table may not have all cols */ }

          // 5. BC partiellement reçu
          const po2 = await dbI.execute(
            `INSERT INTO purchaseOrders (organizationId, vendorId, poNumber, status, totalAmount, currency, notes, issuedAt, createdAt)
             VALUES (${org}, ${v2}, 'BC-SEED-${ts}B', 'partially_received', 420000, 'XOF', 'Fournitures bureau', '${daysAgo(12)}', '${daysAgo(12)}')`
          ) as any;
          const po2Id = Number(po2[0].insertId);
          await dbI.execute(
            `INSERT INTO purchaseOrderItems (poId, itemName, quantity, unitPrice, totalPrice, unit, receivedQuantity)
             VALUES (${po2Id}, 'Ramettes de papier A4', 50, 5000, 250000, 'ramette', 30)`
          );
          log.push("✅ 2 BCs créés (approuvé, partiellement reçu)");

          // 6. Facture en attente
          await dbI.execute(
            `INSERT INTO invoices (organizationId, invoiceNumber, vendorId, poId, invoiceDate, dueDate, amount, taxAmount, currency, status, matchStatus, createdAt)
             VALUES (${org}, 'FAC-SEED-001', ${v2}, ${po2Id}, '${daysAgo(8)}', '${daysFromNow(22)}', 370000, 66600, 'XOF', 'pending', 'matched', '${daysAgo(8)}')`
          );

          // 7. Facture approuvée
          const inv2 = await dbI.execute(
            `INSERT INTO invoices (organizationId, invoiceNumber, vendorId, poId, invoiceDate, dueDate, amount, taxAmount, currency, status, matchStatus, approvedBy, approvedAt, createdAt)
             VALUES (${org}, 'FAC-SEED-002', ${v1}, ${po1Id}, '${daysAgo(5)}', '${daysFromNow(25)}', 1650000, 297000, 'XOF', 'approved', 'matched', ${admin.id}, '${daysAgo(3)}', '${daysAgo(5)}')`
          ) as any;
          const inv2Id = Number(inv2[0].insertId);
          log.push("✅ 2 factures créées (en attente, approuvée)");

          // 8. Paiement
          await dbI.execute(
            `INSERT INTO payments (organizationId, invoiceId, paymentMethod, amount, currency, reference, valueDate, status, notes, createdAt)
             VALUES (${org}, ${inv2Id}, 'bank_transfer', 1947000, 'XOF', 'VIR-SEED-001', '${daysAgo(2)}', 'completed', 'Virement maintenance climatiseurs TTC', '${daysAgo(2)}')`
          );
          await dbI.execute(`UPDATE invoices SET status='paid' WHERE id=${inv2Id} AND organizationId=${org}`);
          log.push("✅ Paiement complété — cycle DA→BC→Facture→Paiement terminé");

        } catch (e) { log.push(`❌ Cycle P2P: ${String(e).slice(0, 100)}`); }
      }

      // ── RFQ CYCLE ──────────────────────────────────────────────────────────
      if (input.scenarios.includes("rfq_cycle")) {
        try {
          const ts = Date.now().toString().slice(-6);
          const rfq = await dbI.execute(
            `INSERT INTO rfqs (organizationId, rfqNumber, title, status, deadline, createdBy, createdAt)
             VALUES (${org}, 'AO-SEED-${ts}', 'Fourniture serveurs datacenter', 'closed', '${daysAgo(2)}', ${manager.id}, '${daysAgo(20)}')`
          ) as any;
          const rfqId = Number(rfq[0].insertId);
          await dbI.execute(`INSERT INTO rfqItems (rfqId, itemName, quantity, unit, estimatedUnitPrice) VALUES (${rfqId}, 'Serveur rack Dell R750', 3, 'pcs', 2500000)`);
          await dbI.execute(`INSERT INTO rfqVendors (rfqId, vendorId, status, invitedAt) VALUES (${rfqId}, ${v1}, 'responded', '${daysAgo(18)}')`);
          await dbI.execute(`INSERT INTO rfqVendors (rfqId, vendorId, status, invitedAt) VALUES (${rfqId}, ${v2}, 'responded', '${daysAgo(18)}')`);
          await dbI.execute(`INSERT INTO rfqResponses (rfqId, vendorId, totalAmount, currency, notes) VALUES (${rfqId}, ${v1}, 7200000, 'XOF', 'Offre incluant installation et formation')`);
          await dbI.execute(`INSERT INTO rfqResponses (rfqId, vendorId, totalAmount, currency, notes) VALUES (${rfqId}, ${v2}, 8500000, 'XOF', 'Offre standard avec garantie 3 ans')`);
          log.push("✅ AO créé (2 réponses reçues, économie 1 300 000 XOF vs offre la plus haute)");
        } catch (e) { log.push(`⚠️ RFQ: ${String(e).slice(0, 80)}`); }
      }

      // ── EXPENSES ───────────────────────────────────────────────────────────
      if (input.scenarios.includes("expenses")) {
        try {
          const ts = Date.now().toString().slice(-6);
          const name = safe(requester.name || "Utilisateur Demo");
          await dbI.execute(
            `INSERT INTO expenseReports (organizationId, reportNumber, submitterId, title, status, totalAmount, periodStart, periodEnd)
             VALUES (${org}, 'NDF-SEED-${ts}A', ${requester.id}, 'Deplacement Cotonou-Abidjan - Salon Tech Africa', 'submitted', 285000, '${daysAgo(14)}', '${daysAgo(10)}')`
          );
          await dbI.execute(
            `INSERT INTO expenseReports (organizationId, reportNumber, submitterId, title, status, totalAmount, periodStart, periodEnd)
             VALUES (${org}, 'NDF-SEED-${ts}B', ${requester.id}, 'Repas clients - Negociation contrat annuel', 'approved', 85000, '${daysAgo(20)}', '${daysAgo(20)}')`
          );
          log.push("✅ 2 notes de frais créées (soumise, approuvée)");
        } catch (e) { log.push(`⚠️ Notes de frais: ${String(e).slice(0, 80)}`); }
      }

      // ── CONTRACTS ──────────────────────────────────────────────────────────
      if (input.scenarios.includes("contracts")) {
        try {
          const ts = Date.now().toString().slice(-6);
          await dbI.execute(
            `INSERT INTO vendorContracts (vendorId, title, contractNumber, startDate, endDate, totalValue, currency, status, createdAt)
             VALUES (${v1}, 'Contrat maintenance IT annuel', 'CTR-SEED-${ts}A', '${daysAgo(180)}', '${daysFromNow(185)}', 3600000, 'XOF', 'active', '${daysAgo(180)}')`
          );
          await dbI.execute(
            `INSERT INTO vendorContracts (vendorId, title, contractNumber, startDate, endDate, totalValue, currency, status, createdAt)
             VALUES (${v2}, 'Fournitures bureau cadre annuel', 'CTR-SEED-${ts}B', '${daysAgo(90)}', '${daysFromNow(275)}', 1200000, 'XOF', 'active', '${daysAgo(90)}')`
          );
          await dbI.execute(
            `INSERT INTO vendorContracts (vendorId, title, contractNumber, startDate, endDate, totalValue, currency, status, createdAt)
             VALUES (${v1}, 'Contrat securite-gardiennage', 'CTR-SEED-${ts}C', '${daysAgo(335)}', '${daysFromNow(30)}', 2400000, 'XOF', 'active', '${daysAgo(335)}')`
          );
          log.push("✅ 3 contrats créés (dont 1 expire dans 30 jours)");
        } catch (e) { log.push(`⚠️ Contrats: ${String(e).slice(0, 80)}`); }
      }

      // ── EDGE CASES ─────────────────────────────────────────────────────────
      if (input.scenarios.includes("edge_cases")) {
        try {
          const ts = Date.now().toString().slice(-6);
          await dbI.execute(
            `INSERT INTO invoices (organizationId, invoiceNumber, vendorId, invoiceDate, dueDate, amount, taxAmount, currency, status, matchStatus, createdAt)
             VALUES (${org}, 'FAC-OVERDUE-${ts}', ${v3 || v1}, '${daysAgo(45)}', '${daysAgo(15)}', 550000, 99000, 'XOF', 'approved', 'unmatched', '${daysAgo(45)}')`
          );
          await dbI.execute(
            `INSERT INTO purchaseRequests (organizationId, requestNumber, requesterId, title, status, urgencyLevel, amountEstimate, currency, createdAt)
             VALUES (${org}, 'DA-REJECTED-${ts}', ${requester.id}, 'Achat véhicule de service', 'rejected', 'medium', 12000000, 'XOF', '${daysAgo(25)}')`
          );
          await dbI.execute(
            `INSERT INTO invoices (organizationId, invoiceNumber, vendorId, invoiceDate, amount, currency, status, matchStatus, disputeReason, disputedAt, createdAt)
             VALUES (${org}, 'FAC-DISPUTE-${ts}', ${v2}, '${daysAgo(15)}', 780000, 'XOF', 'disputed', 'exception', 'Montant ne correspond pas au BC — écart de 80 000 XOF', '${daysAgo(10)}', '${daysAgo(15)}')`
          );
          log.push("✅ Cas limites: facture en retard, DA refusée, facture contestée");
        } catch (e) { log.push(`⚠️ Cas limites: ${String(e).slice(0, 80)}`); }
      }

      return { success: true, log, summary: `${log.filter(l => l.startsWith("✅")).length} scénarios réussis` };
    }),
});
