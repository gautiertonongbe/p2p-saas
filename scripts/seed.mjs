import { drizzle } from "drizzle-orm/mysql2";
import bcrypt from "bcryptjs";
import {
  organizations, lookupTypes, lookupValues, departments,
  approvalPolicies, approvalSteps, users
} from "../drizzle/schema.js";
import { eq } from "drizzle-orm";

const db = drizzle(process.env.DATABASE_URL);

async function seed() {
  console.log("🌱 Seeding database...");

  try {
    // ── Idempotent: skip if org already exists ────────────────────────────
    const existing = await db.select().from(organizations).limit(1);
    if (existing.length > 0) {
      const orgId = existing[0].id;
      console.log(`✅ Organization already seeded (ID: ${orgId}). Skipping.`);
      console.log("   Run with --force to re-seed (drops existing data).");
      process.exit(0);
    }

    // ── Organization ──────────────────────────────────────────────────────
    const orgResult = await db.insert(organizations).values({
      legalName: "Demo Company SARL",
      tradeName: "Demo Company",
      country: "Benin",
      baseCurrency: "XOF",
      fiscalYearStart: "01-01",
      city: "Cotonou",
      settings: {
        toleranceRules: { priceVariance: 5, quantityVariance: 2, amountVariance: 5, autoApproveBelow: 0 },
        budgetPolicies: { enforceBudgetCheck: false, warningThresholdPercent: 80, criticalThresholdPercent: 95, allowOverspend: true, requireBudgetCode: false, carryForwardUnspent: false },
        workflowSettings: { autoApproveAmount: 0, requireJustification: false, minRFQVendors: 3, rfqDeadlineDays: 14, poAutoIssue: false, slaHours: 48, escalationEnabled: true, segregationOfDuties: true },
        notificationSettings: { emailEnabled: false, inAppEnabled: true, events: { newPurchaseRequest: true, approvalRequired: true, approvalApproved: true, approvalRejected: true, approvalOverdue: true, budgetAlert: true, invoiceReceived: true, invoiceOverdue: true, poIssued: false, contractExpiring: true, lowStock: true, rfqResponse: true } },
        localization: { language: "fr", dateFormat: "DD/MM/YYYY", numberFormat: "fr-FR", timezone: "Africa/Porto-Novo" },
        numberingSequences: { prPrefix: "DA", poPrefix: "BC", invoicePrefix: "FAC", rfqPrefix: "AO" },
        paymentTerms: [
          { code: "IMMEDIATE", label: "Paiement immédiat", days: 0 },
          { code: "NET30", label: "Net 30 jours", days: 30 },
          { code: "NET60", label: "Net 60 jours", days: 60 },
        ],
        taxRates: [
          { code: "EXONERE", label: "Exonéré (0%)", rate: 0, isDefault: false },
          { code: "TVA18", label: "TVA 18%", rate: 18, isDefault: true },
        ],
        customFields: [],
        exchangeRates: { EUR: 655.957, USD: 605.0, GBP: 762.0, GHS: 44.0 },
        vendorPortal: { enabled: false, requireApprovalToOnboard: true, allowSelfRegistration: false },
      },
    });
    const orgId = orgResult[0].insertId;
    console.log(`✅ Created organization (ID: ${orgId})`);

    // ── Users ──────────────────────────────────────────────────────────────
    const existingUsers = await db.select().from(users).where(eq(users.organizationId, orgId)).limit(1);
    if (existingUsers.length === 0) {
      const adminHash = await bcrypt.hash("Admin1234!", 12);
      const managerHash = await bcrypt.hash("Manager1234!", 12);

      await db.insert(users).values([
        { openId: "admin-001", organizationId: orgId, name: "Administrateur", email: "admin@demo.com", role: "admin", status: "active", loginMethod: "email", password: adminHash, lastSignedIn: new Date() },
        { openId: "manager-001", organizationId: orgId, name: "Responsable Achats", email: "manager@demo.com", role: "procurement_manager", status: "active", loginMethod: "email", password: managerHash, lastSignedIn: new Date() },
        { openId: "approver-001", organizationId: orgId, name: "Approbateur", email: "approver@demo.com", role: "approver", status: "active", loginMethod: "email", password: managerHash, lastSignedIn: new Date() },
        { openId: "requester-001", organizationId: orgId, name: "Demandeur", email: "requester@demo.com", role: "requester", status: "active", loginMethod: "email", password: managerHash, lastSignedIn: new Date() },
      ]);
      console.log("✅ Created 4 demo users");
    }

    // ── Departments ───────────────────────────────────────────────────────
    await db.insert(departments).values([
      { organizationId: orgId, code: "IT",  name: "Information Technology", isActive: true },
      { organizationId: orgId, code: "FIN", name: "Finance",                isActive: true },
      { organizationId: orgId, code: "OPS", name: "Operations",             isActive: true },
      { organizationId: orgId, code: "HR",  name: "Human Resources",        isActive: true },
      { organizationId: orgId, code: "COM", name: "Commercial",             isActive: true },
    ]);
    console.log("✅ Created 5 departments");

    // ── Lookup types & values ─────────────────────────────────────────────
    const lookupData = [
      {
        name: "ExpenseCategory",
        description: "Expense categories for purchase requests",
        values: [
          { code: "IT-HW",       label: "IT Hardware" },
          { code: "IT-SW",       label: "IT Software & Licences" },
          { code: "OFFICE",      label: "Fournitures de bureau" },
          { code: "TRAVEL",      label: "Déplacements & Transport" },
          { code: "SERVICES",    label: "Services professionnels" },
          { code: "FACILITIES",  label: "Bâtiments & Maintenance" },
          { code: "MARKETING",   label: "Marketing & Communication" },
          { code: "TRAINING",    label: "Formation & Développement" },
        ],
      },
      {
        name: "Project",
        description: "Project codes for budget allocation",
        values: [
          { code: "PROJ-001", label: "Projet Infrastructure SI" },
          { code: "PROJ-002", label: "Expansion Commerciale" },
          { code: "PROJ-003", label: "Transformation Digitale" },
        ],
      },
      {
        name: "CostCenter",
        description: "Cost center codes",
        values: [
          { code: "CC-IT",  label: "Centre de coût IT" },
          { code: "CC-FIN", label: "Centre de coût Finance" },
          { code: "CC-OPS", label: "Centre de coût Opérations" },
        ],
      },
      {
        name: "BillingString",
        description: "Billing string identifiers",
        values: [
          { code: "BS-2026-Q1", label: "Budget Q1 2026" },
          { code: "BS-2026-Q2", label: "Budget Q2 2026" },
          { code: "BS-2026-Q3", label: "Budget Q3 2026" },
          { code: "BS-2026-Q4", label: "Budget Q4 2026" },
        ],
      },
    ];

    for (const type of lookupData) {
      const typeResult = await db.insert(lookupTypes).values({
        organizationId: orgId,
        name: type.name,
        description: type.description,
        isSystem: true,
        isEditable: true,
      });
      const typeId = typeResult[0].insertId;
      await db.insert(lookupValues).values(
        type.values.map(v => ({ lookupTypeId: typeId, code: v.code, label: v.label, isActive: true }))
      );
    }
    console.log("✅ Created lookup types and values");

    // ── Approval Policies ─────────────────────────────────────────────────
    const policy1 = await db.insert(approvalPolicies).values({
      organizationId: orgId,
      name: "Approbation Manager — Petits montants (< 500 000 XOF)",
      description: "Demandes inférieures à 500 000 XOF: approbation du responsable achats uniquement",
      conditions: { minAmount: 0, maxAmount: 499999 },
      isActive: true,
      priority: 1,
    });

    const policy2 = await db.insert(approvalPolicies).values({
      organizationId: orgId,
      name: "Manager + Finance — Montants moyens (500 000 – 2 000 000 XOF)",
      description: "Demandes de 500 000 à 2 000 000 XOF: approbation manager puis finance",
      conditions: { minAmount: 500000, maxAmount: 2000000 },
      isActive: true,
      priority: 2,
    });

    const policy3 = await db.insert(approvalPolicies).values({
      organizationId: orgId,
      name: "Chaîne complète — Grands montants (> 2 000 000 XOF)",
      description: "Demandes supérieures à 2 000 000 XOF: manager → finance → direction générale",
      conditions: { minAmount: 2000001 },
      isActive: true,
      priority: 3,
    });

    console.log("✅ Created 3 approval policies");

    // ── Approval Steps ────────────────────────────────────────────────────
    // Policy 1: Manager only
    await db.insert(approvalSteps).values({
      policyId: policy1[0].insertId,
      stepOrder: 1,
      approverType: "role",
      approverId: 2, // procurement_manager
      isParallel: false,
    });

    // Policy 2: Manager → Finance
    await db.insert(approvalSteps).values([
      { policyId: policy2[0].insertId, stepOrder: 1, approverType: "role", approverId: 2, isParallel: false },
      { policyId: policy2[0].insertId, stepOrder: 2, approverType: "role", approverId: 3, isParallel: false },
    ]);

    // Policy 3: Manager → Finance → Admin
    await db.insert(approvalSteps).values([
      { policyId: policy3[0].insertId, stepOrder: 1, approverType: "role", approverId: 2, isParallel: false },
      { policyId: policy3[0].insertId, stepOrder: 2, approverType: "role", approverId: 3, isParallel: false },
      { policyId: policy3[0].insertId, stepOrder: 3, approverType: "role", approverId: 1, isParallel: false },
    ]);

    console.log("✅ Created approval steps for all policies");

    console.log("\n✨ Database seeded successfully!");
    console.log(`\n  Organization ID: ${orgId}`);
    console.log("\n  Role guide for approval testing:");
    console.log("  - requester          → Creates purchase requests");
    console.log("  - procurement_manager → Approves step 1 (all policies)");
    console.log("  - approver           → Approves step 2 (policies 2 & 3)");
    console.log("  - admin              → Approves step 3 (policy 3) + can bypass any");
    console.log("\n  Tip: Set your role in Settings → Users after first login.");

  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  }

  process.exit(0);
}

seed();
