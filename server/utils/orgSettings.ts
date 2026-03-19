/**
 * Organisation Settings Resolver
 * 
 * Single source of truth for reading org-level configuration.
 * All business logic should use getOrgSettings() instead of
 * hardcoding values or querying the DB directly.
 */

import { getDb } from "../db";
import { organizations } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

type OrgSettings = NonNullable<(typeof organizations.$inferSelect)["settings"]>;

// Sensible production defaults — used when org has not configured a value
const DEFAULTS: Required<OrgSettings> = {
  toleranceRules: {
    priceVariance: 5,
    quantityVariance: 2,
    amountVariance: 5,
    autoApproveBelow: 0,
  },
  budgetPolicies: {
    enforceBudgetCheck: false,          // off by default — don't block orgs on first use
    warningThresholdPercent: 80,
    criticalThresholdPercent: 95,
    allowOverspend: true,
    requireBudgetCode: false,
    carryForwardUnspent: false,
  },
  workflowSettings: {
    autoApproveAmount: 0,               // 0 = disabled
    requireJustification: false,
    minRFQVendors: 3,
    rfqDeadlineDays: 14,
    poAutoIssue: false,
    slaHours: 48,
    escalationEnabled: true,
    segregationOfDuties: true,
  },
  notificationSettings: {
    emailEnabled: false,
    inAppEnabled: true,
    events: {
      newPurchaseRequest: true,
      approvalRequired: true,
      approvalApproved: true,
      approvalRejected: true,
      approvalOverdue: true,
      budgetAlert: true,
      invoiceReceived: true,
      invoiceOverdue: true,
      poIssued: false,
      contractExpiring: true,
      lowStock: true,
      rfqResponse: true,
    },
  },
  localization: {
    language: "fr",
    dateFormat: "DD/MM/YYYY",
    numberFormat: "fr-FR",
    timezone: "Africa/Porto-Novo",
  },
  numberingSequences: {
    prPrefix: "DA",
    poPrefix: "BC",
    invoicePrefix: "FAC",
    rfqPrefix: "AO",
  },
  vendorPortal: {
    enabled: false,
    requireApprovalToOnboard: true,
    allowSelfRegistration: false,
  },
  paymentTerms: [
    { code: "NET30", label: "Net 30 jours", days: 30 },
  ],
  taxRates: [
    { code: "TVA18", label: "TVA 18%", rate: 18, isDefault: true },
  ],
  customFields: [],
  exchangeRates: { EUR: 655.957, USD: 605.0 },
};

const cache = new Map<number, { settings: Required<OrgSettings>; fetchedAt: number }>();
const CACHE_TTL_MS = 60_000; // 1 minute

export async function getOrgSettings(organizationId: number): Promise<Required<OrgSettings>> {
  // Cache hit
  const hit = cache.get(organizationId);
  if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) {
    return hit.settings;
  }

  const db = await getDb();
  if (!db) return DEFAULTS;

  const [org] = await db.select({ settings: organizations.settings })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  const saved = org?.settings ?? {};

  // Deep merge org settings over defaults
  const merged: Required<OrgSettings> = {
    toleranceRules:       { ...DEFAULTS.toleranceRules,       ...(saved.toleranceRules       ?? {}) },
    budgetPolicies:       { ...DEFAULTS.budgetPolicies,       ...(saved.budgetPolicies       ?? {}) },
    workflowSettings:     { ...DEFAULTS.workflowSettings,     ...(saved.workflowSettings     ?? {}) },
    notificationSettings: {
      ...DEFAULTS.notificationSettings,
      ...(saved.notificationSettings ?? {}),
      events: {
        ...DEFAULTS.notificationSettings.events,
        ...((saved.notificationSettings as any)?.events ?? {}),
      },
    },
    localization:         { ...DEFAULTS.localization,         ...(saved.localization         ?? {}) },
    numberingSequences:   { ...DEFAULTS.numberingSequences,   ...(saved.numberingSequences   ?? {}) },
    vendorPortal:         { ...DEFAULTS.vendorPortal,         ...(saved.vendorPortal         ?? {}) },
    paymentTerms:         (saved as any).paymentTerms         ?? DEFAULTS.paymentTerms,
    taxRates:             (saved as any).taxRates             ?? DEFAULTS.taxRates,
    customFields:         (saved as any).customFields         ?? DEFAULTS.customFields,
    exchangeRates:        (saved as any).exchangeRates        ?? DEFAULTS.exchangeRates,
  };

  cache.set(organizationId, { settings: merged, fetchedAt: Date.now() });
  return merged;
}

// Invalidate cache when org settings are updated
export function invalidateOrgSettingsCache(organizationId: number): void {
  cache.delete(organizationId);
}

// Convenience accessors
export const getWorkflow   = (s: Required<OrgSettings>) => s.workflowSettings;
export const getBudget     = (s: Required<OrgSettings>) => s.budgetPolicies;
export const getTolerance  = (s: Required<OrgSettings>) => s.toleranceRules;
export const getNumbering  = (s: Required<OrgSettings>) => s.numberingSequences;
export const getLocale     = (s: Required<OrgSettings>) => s.localization;
