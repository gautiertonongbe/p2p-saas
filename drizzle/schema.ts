import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, json, index } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

/**
 * ENTERPRISE P2P PLATFORM - DATABASE SCHEMA
 * Multi-tenant procurement system for Benin & Côte d'Ivoire (XOF currency)
 */

// ============================================================================
// CORE: Organizations & Users
// ============================================================================

export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  legalName: varchar("legalName", { length: 255 }).notNull(),
  tradeName: varchar("tradeName", { length: 255 }),
  country: varchar("country", { length: 100 }).notNull().default("Benin"),
  baseCurrency: varchar("baseCurrency", { length: 3 }).default("XOF").notNull(),
  fiscalYearStart: varchar("fiscalYearStart", { length: 5 }).default("01-01"),
  // Address & contact
  address: varchar("address", { length: 500 }),
  city: varchar("city", { length: 100 }),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 320 }),
  website: varchar("website", { length: 255 }),
  taxId: varchar("taxId", { length: 100 }),
  // Branding
  logoUrl: text("logoUrl"),
  primaryColor: varchar("primaryColor", { length: 7 }).default("#2563eb"),
  // Full configurable settings (JSON blob)
  settings: json("settings").$type<{
    // Three-way match tolerances
    toleranceRules?: {
      priceVariance: number;       // % price tolerance on 3-way match
      quantityVariance: number;    // % qty tolerance
      amountVariance: number;      // % total amount tolerance
      autoApproveBelow?: number;   // Auto-approve invoices below this amount
    };
    // Budget controls
    budgetPolicies?: {
      enforceBudgetCheck: boolean;          // Block PRs that exceed budget
      warningThresholdPercent: number;       // e.g. 80 → alert at 80% consumed
      criticalThresholdPercent: number;      // e.g. 95 → critical alert
      allowOverspend: boolean;               // Allow overspend with reason
      requireBudgetCode: boolean;            // Force cost center on every PR
      carryForwardUnspent: boolean;          // Roll unspent budget to next period
    };
    // Workflow & automation
    workflowSettings?: {
      autoApproveAmount: number;             // PRs below this skip approval
      requireJustification: boolean;         // Always require justification text
      minRFQVendors: number;                 // Minimum vendors for RFQ (default 3)
      rfqDeadlineDays: number;               // Default RFQ deadline
      poAutoIssue: boolean;                  // Auto-issue PO on PR approval
      slaHours: number;                      // Approval SLA in hours
      escalationEnabled: boolean;
      segregationOfDuties: boolean;          // Block self-approval
    };
    // Notification preferences
    notificationSettings?: {
      emailEnabled: boolean;
      inAppEnabled: boolean;
      events: {
        newPurchaseRequest: boolean;
        approvalRequired: boolean;
        approvalApproved: boolean;
        approvalRejected: boolean;
        approvalOverdue: boolean;
        budgetAlert: boolean;
        invoiceReceived: boolean;
        invoiceOverdue: boolean;
        poIssued: boolean;
        contractExpiring: boolean;
        lowStock: boolean;
        rfqResponse: boolean;
      };
    };
    // Localization
    localization?: {
      language: string;             // fr | en
      dateFormat: string;           // DD/MM/YYYY | MM/DD/YYYY
      numberFormat: string;         // fr-FR | en-US
      timezone: string;
    };
    // Numbering sequences
    numberingSequences?: {
      prPrefix: string;             // e.g. "DA"
      poPrefix: string;             // e.g. "BC"
      invoicePrefix: string;        // e.g. "FAC"
      rfqPrefix: string;            // e.g. "AO"
    };
    // Vendor portal
    vendorPortal?: {
      enabled: boolean;
      requireApprovalToOnboard: boolean;
      allowSelfRegistration: boolean;
    };
    // Payment terms (available on POs and vendor profiles)
    paymentTerms?: Array<{
      code: string;       // NET30
      label: string;      // Net 30 jours
      days: number;       // 30
      discountPercent?: number;  // 2 for "2/10 Net 30"
      discountDays?: number;
    }>;
    // Tax rates
    taxRates?: Array<{
      code: string;       // TVA_18
      label: string;      // TVA 18%
      rate: number;       // 18
      isDefault: boolean;
    }>;
    // Custom fields on documents
    customFields?: Array<{
      id: string;
      entity: "purchaseRequest" | "purchaseOrder" | "invoice" | "vendor";
      label: string;
      type: "text" | "number" | "date" | "select" | "boolean";
      required: boolean;
      options?: string[];  // for type=select
      isActive: boolean;
    }>;
    // Exchange rates
    exchangeRates?: Record<string, number>;  // e.g. { EUR: 655.957, USD: 605.0 }
  }>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  organizationId: int("organizationId").notNull(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  departmentId: int("departmentId"),
  role: mysqlEnum("role", ["admin", "procurement_manager", "approver", "requester"]).default("requester").notNull(),
  approvalLimit: decimal("approvalLimit", { precision: 15, scale: 2 }), // XOF amount
  status: mysqlEnum("status", ["active", "disabled"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  password: varchar("password", { length: 255 }), // bcrypt hash
}, (table) => ({
  orgIdx: index("org_idx").on(table.organizationId),
  deptIdx: index("dept_idx").on(table.departmentId),
}));

export const departments = mysqlTable("departments", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  code: varchar("code", { length: 50 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  managerId: int("managerId"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  orgIdx: index("org_idx").on(table.organizationId),
}));

// ============================================================================
// LOOKUP FRAMEWORK (SAP-inspired)
// ============================================================================

export const lookupTypes = mysqlTable("lookupTypes", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  name: varchar("name", { length: 100 }).notNull(), // BillingString, CostCenter, GLAccount, ExpenseCategory, Project
  description: text("description"),
  isSystem: boolean("isSystem").default(false).notNull(),
  isEditable: boolean("isEditable").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  orgIdx: index("org_idx").on(table.organizationId),
}));

export const lookupValues = mysqlTable("lookupValues", {
  id: int("id").autoincrement().primaryKey(),
  lookupTypeId: int("lookupTypeId").notNull(),
  code: varchar("code", { length: 50 }).notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  parentValueId: int("parentValueId"), // For hierarchical lookups
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  typeIdx: index("type_idx").on(table.lookupTypeId),
}));

// ============================================================================
// SUPPLIERS/VENDORS
// ============================================================================

export const vendors = mysqlTable("vendors", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  legalName: varchar("legalName", { length: 255 }).notNull(),
  tradeName: varchar("tradeName", { length: 255 }),
  country: varchar("country", { length: 100 }),
  taxId: varchar("taxId", { length: 100 }),
  isFormal: boolean("isFormal").default(true).notNull(), // Support semi-formal suppliers
  contactName: varchar("contactName", { length: 255 }),
  contactEmail: varchar("contactEmail", { length: 320 }),
  contactPhone: varchar("contactPhone", { length: 50 }),
  bankAccounts: json("bankAccounts").$type<Array<{ bankName: string; accountNumber: string; iban?: string }>>(),
  mobileMoneyAccounts: json("mobileMoneyAccounts").$type<Array<{ provider: string; number: string }>>(),
  status: mysqlEnum("status", ["active", "inactive", "pending"]).default("pending").notNull(),
  performanceScore: decimal("performanceScore", { precision: 5, scale: 2 }), // 0-100
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  orgIdx: index("org_idx").on(table.organizationId),
}));

export const vendorContracts = mysqlTable("vendorContracts", {
  id: int("id").autoincrement().primaryKey(),
  vendorId: int("vendorId").notNull(),
  contractNumber: varchar("contractNumber", { length: 100 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate"),
  totalValue: decimal("totalValue", { precision: 15, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("XOF"),
  status: mysqlEnum("status", ["active", "expired", "terminated"]).default("active").notNull(),
  documentUrl: text("documentUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  vendorIdx: index("vendor_idx").on(table.vendorId),
}));

// ============================================================================
// BUDGETS
// ============================================================================

export const budgets = mysqlTable("budgets", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  scopeType: mysqlEnum("scopeType", ["department", "project", "category"]).notNull(),
  scopeId: int("scopeId").notNull(), // References department, project, or category
  fiscalPeriod: varchar("fiscalPeriod", { length: 20 }).notNull(), // e.g., "2026-Q1" or "2026-01"
  allocatedAmount: decimal("allocatedAmount", { precision: 15, scale: 2 }).notNull(),
  committedAmount: decimal("committedAmount", { precision: 15, scale: 2 }).default("0").notNull(),
  actualAmount: decimal("actualAmount", { precision: 15, scale: 2 }).default("0").notNull(),
  currency: varchar("currency", { length: 3 }).default("XOF"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  orgIdx: index("org_idx").on(table.organizationId),
  scopeIdx: index("scope_idx").on(table.scopeType, table.scopeId),
}));

// ============================================================================
// PURCHASE REQUISITIONS
// ============================================================================

export const purchaseRequests = mysqlTable("purchaseRequests", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  requestNumber: varchar("requestNumber", { length: 50 }).notNull().unique(),
  requesterId: int("requesterId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  categoryId: int("categoryId"), // Lookup value
  billingStringId: int("billingStringId"), // Lookup value
  costCenterId: int("costCenterId"), // Lookup value
  projectId: int("projectId"), // Lookup value
  departmentId: int("departmentId"),
  amountEstimate: decimal("amountEstimate", { precision: 15, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("XOF"),
  taxIncluded: boolean("taxIncluded").default(false).notNull(),
  urgencyLevel: mysqlEnum("urgencyLevel", ["low", "medium", "high", "critical"]).default("medium").notNull(),
  status: mysqlEnum("status", ["draft", "submitted", "pending_approval", "approved", "rejected", "cancelled"]).default("draft").notNull(),
  currentApprovalStep: int("currentApprovalStep").default(0),
  attachments: json("attachments").$type<Array<{ filename: string; url: string; uploadedAt: string }>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  orgIdx: index("org_idx").on(table.organizationId),
  requesterIdx: index("requester_idx").on(table.requesterId),
  statusIdx: index("status_idx").on(table.status),
}));

export const purchaseRequestItems = mysqlTable("purchaseRequestItems", {
  id: int("id").autoincrement().primaryKey(),
  requestId: int("requestId").notNull(),
  itemName: varchar("itemName", { length: 255 }).notNull(),
  description: text("description"),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unitPrice: decimal("unitPrice", { precision: 15, scale: 2 }).notNull(),
  totalPrice: decimal("totalPrice", { precision: 15, scale: 2 }).notNull(),
  unit: varchar("unit", { length: 50 }),
  preferredVendorId: int("preferredVendorId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  requestIdx: index("request_idx").on(table.requestId),
}));

// ============================================================================
// APPROVAL WORKFLOWS
// ============================================================================

export const approvalPolicies = mysqlTable("approvalPolicies", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  conditions: json("conditions").$type<{
    minAmount?: number;
    maxAmount?: number;
    categoryIds?: number[];
    departmentIds?: number[];
    urgencyLevels?: string[];
  }>(),
  isActive: boolean("isActive").default(true).notNull(),
  priority: int("priority").default(0), // Higher priority policies evaluated first
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  orgIdx: index("org_idx").on(table.organizationId),
}));

export const approvalSteps = mysqlTable("approvalSteps", {
  id: int("id").autoincrement().primaryKey(),
  policyId: int("policyId").notNull(),
  stepOrder: int("stepOrder").notNull(),
  approverType: mysqlEnum("approverType", ["role", "user", "manager"]).notNull(),
  approverId: int("approverId"), // User ID or role reference
  isParallel: boolean("isParallel").default(false).notNull(), // Allow parallel approvals
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  policyIdx: index("policy_idx").on(table.policyId),
}));

export const approvals = mysqlTable("approvals", {
  id: int("id").autoincrement().primaryKey(),
  requestId: int("requestId").notNull(),
  stepOrder: int("stepOrder").notNull(),
  approverId: int("approverId").notNull(),
  decision: mysqlEnum("decision", ["pending", "approved", "rejected", "delegated"]).default("pending").notNull(),
  comment: text("comment"),
  decidedAt: timestamp("decidedAt"),
  delegatedTo: int("delegatedTo"),
  dueAt: timestamp("dueAt"), // SLA deadline — null = no SLA
  escalatedAt: timestamp("escalatedAt"), // when escalation was triggered
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  requestIdx: index("request_idx").on(table.requestId),
  approverIdx: index("approver_idx").on(table.approverId),
}));

// ============================================================================
// PURCHASE ORDERS
// ============================================================================

export const purchaseOrders = mysqlTable("purchaseOrders", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  poNumber: varchar("poNumber", { length: 50 }).notNull().unique(),
  requestId: int("requestId"),
  vendorId: int("vendorId").notNull(),
  totalAmount: decimal("totalAmount", { precision: 15, scale: 2 }).notNull(),
  taxAmount: decimal("taxAmount", { precision: 15, scale: 2 }).default("0"),
  currency: varchar("currency", { length: 3 }).default("XOF"),
  status: mysqlEnum("status", ["draft", "issued", "confirmed", "approved", "rejected", "partially_received", "received", "closed", "cancelled"]).default("draft").notNull(),
  issuedAt: timestamp("issuedAt"),
  expectedDeliveryDate: timestamp("expectedDeliveryDate"),
  approvedBy: int("approvedBy"),
  approvedAt: timestamp("approvedAt"),
  version: int("version").default(1).notNull(), // For amendments
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  orgIdx: index("org_idx").on(table.organizationId),
  vendorIdx: index("vendor_idx").on(table.vendorId),
  statusIdx: index("status_idx").on(table.status),
}));

export const purchaseOrderItems = mysqlTable("purchaseOrderItems", {
  id: int("id").autoincrement().primaryKey(),
  poId: int("poId").notNull(),
  itemName: varchar("itemName", { length: 255 }).notNull(),
  description: text("description"),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unitPrice: decimal("unitPrice", { precision: 15, scale: 2 }).notNull(),
  totalPrice: decimal("totalPrice", { precision: 15, scale: 2 }).notNull(),
  unit: varchar("unit", { length: 50 }),
  receivedQuantity: decimal("receivedQuantity", { precision: 10, scale: 2 }).default("0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  poIdx: index("po_idx").on(table.poId),
}));

export const receipts = mysqlTable("receipts", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  poId: int("poId").notNull(),
  receiptNumber: varchar("receiptNumber", { length: 50 }).notNull().unique(),
  receivedBy: int("receivedBy").notNull(),
  receivedAt: timestamp("receivedAt").defaultNow().notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  orgIdx: index("org_idx").on(table.organizationId),
  poIdx: index("po_idx").on(table.poId),
}));

export const receiptItems = mysqlTable("receiptItems", {
  id: int("id").autoincrement().primaryKey(),
  receiptId: int("receiptId").notNull(),
  poItemId: int("poItemId").notNull(),
  quantityReceived: decimal("quantityReceived", { precision: 10, scale: 2 }).notNull(),
  condition: mysqlEnum("condition", ["good", "damaged", "partial"]).default("good").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  receiptIdx: index("receipt_idx").on(table.receiptId),
}));

// ============================================================================
// INVOICES
// ============================================================================

export const invoices = mysqlTable("invoices", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  invoiceNumber: varchar("invoiceNumber", { length: 100 }).notNull(),
  vendorId: int("vendorId").notNull(),
  poId: int("poId"),
  invoiceDate: timestamp("invoiceDate").notNull(),
  dueDate: timestamp("dueDate"),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  taxAmount: decimal("taxAmount", { precision: 15, scale: 2 }).default("0"),
  currency: varchar("currency", { length: 3 }).default("XOF"),
  invoiceFileUrl: text("invoiceFileUrl"),
  ocrData: json("ocrData").$type<{
    extractedVendor?: string;
    extractedAmount?: number;
    extractedDate?: string;
    lineItems?: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
    confidence?: number;
  }>(),
  matchStatus: mysqlEnum("matchStatus", ["unmatched", "matched", "exception", "manual_review"]).default("unmatched").notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "disputed", "revised", "paid", "cancelled"]).default("pending").notNull(),
  // Dispute tracking
  disputeReason: text("disputeReason"),
  disputedAt: timestamp("disputedAt"),
  disputedBy: int("disputedBy"),
  disputeResolution: text("disputeResolution"),
  resolvedAt: timestamp("resolvedAt"),
  // Revision tracking
  originalInvoiceId: int("originalInvoiceId"),  // if this is a revised invoice, points to original
  revisionNumber: int("revisionNumber").default(1),
  revisionNote: text("revisionNote"),
  approvedBy: int("approvedBy"),
  approvedAt: timestamp("approvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  orgIdx: index("org_idx").on(table.organizationId),
  vendorIdx: index("vendor_idx").on(table.vendorId),
  poIdx: index("po_idx").on(table.poId),
  statusIdx: index("status_idx").on(table.status),
}));

// ============================================================================
// PAYMENTS
// ============================================================================

export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  invoiceId: int("invoiceId").notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["bank_transfer", "mobile_money", "check", "cash"]).notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("XOF"),
  reference: varchar("reference", { length: 255 }),
  valueDate: timestamp("valueDate").notNull(),
  status: mysqlEnum("status", ["scheduled", "processing", "completed", "failed", "cancelled"]).default("scheduled").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  orgIdx: index("org_idx").on(table.organizationId),
  invoiceIdx: index("invoice_idx").on(table.invoiceId),
}));

// ============================================================================
// INVENTORY
// ============================================================================

export const warehouses = mysqlTable("warehouses", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  code: varchar("code", { length: 50 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  location: varchar("location", { length: 255 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  orgIdx: index("org_idx").on(table.organizationId),
}));

export const inventoryItems = mysqlTable("inventoryItems", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  itemCode: varchar("itemCode", { length: 100 }).notNull(),
  itemName: varchar("itemName", { length: 255 }).notNull(),
  description: text("description"),
  unit: varchar("unit", { length: 50 }),
  reorderLevel: decimal("reorderLevel", { precision: 10, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  orgIdx: index("org_idx").on(table.organizationId),
}));

export const inventoryStock = mysqlTable("inventoryStock", {
  id: int("id").autoincrement().primaryKey(),
  itemId: int("itemId").notNull(),
  warehouseId: int("warehouseId").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).default("0").notNull(),
  lastUpdated: timestamp("lastUpdated").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  itemIdx: index("item_idx").on(table.itemId),
  warehouseIdx: index("warehouse_idx").on(table.warehouseId),
}));

// ============================================================================
// AUDIT & REPORTING
// ============================================================================

export const auditLogs = mysqlTable("auditLogs", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  entityType: varchar("entityType", { length: 100 }).notNull(), // purchaseRequest, invoice, etc.
  entityId: int("entityId").notNull(),
  action: varchar("action", { length: 100 }).notNull(), // created, updated, approved, etc.
  actorId: int("actorId").notNull(),
  oldValue: json("oldValue"),
  newValue: json("newValue"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => ({
  orgIdx: index("org_idx").on(table.organizationId),
  entityIdx: index("entity_idx").on(table.entityType, table.entityId),
  timestampIdx: index("timestamp_idx").on(table.timestamp),
}));

export const savedViews = mysqlTable("savedViews", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  userId: int("userId").notNull(),
  entity: varchar("entity", { length: 100 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  // Filter conditions: [{field, operator, value, label}]
  filters: json("filters").$type<Array<{
    field: string;
    operator: string;
    value: string;
    label?: string;
  }>>(),
  // Which columns to display and in what order
  columns: json("columns").$type<string[]>(),
  // Sort state
  sortBy: varchar("sortBy", { length: 100 }),
  sortDir: mysqlEnum("sortDir", ["asc", "desc"]).default("asc"),
  // Display mode
  displayType: mysqlEnum("displayType", ["table", "cards", "compact"]).default("table").notNull(),
  // Sharing
  isShared: boolean("isShared").default(false).notNull(),   // visible to whole org
  isDefault: boolean("isDefault").default(false).notNull(), // auto-applies on page load
  // Who can edit (only creator or admins)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  orgIdx: index("org_idx").on(table.organizationId),
  userIdx: index("user_idx").on(table.userId),
  entityIdx: index("entity_idx").on(table.entity, table.organizationId),
}));

// ============================================================================
// RFQ — REQUEST FOR QUOTATION
// ============================================================================

export const rfqs = mysqlTable("rfqs", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  rfqNumber: varchar("rfqNumber", { length: 50 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  requestId: int("requestId"), // linked PR (optional)
  deadline: timestamp("deadline").notNull(),
  status: mysqlEnum("status", ["draft", "sent", "closed", "awarded", "cancelled"]).default("draft").notNull(),
  createdBy: int("createdBy").notNull(),
  awardedVendorId: int("awardedVendorId"),
  evaluationCriteria: json("evaluationCriteria").$type<Array<{ name: string; weight: number }>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  orgIdx: index("org_idx").on(table.organizationId),
}));

export const rfqItems = mysqlTable("rfqItems", {
  id: int("id").autoincrement().primaryKey(),
  rfqId: int("rfqId").notNull(),
  itemName: varchar("itemName", { length: 255 }).notNull(),
  description: text("description"),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unit: varchar("unit", { length: 50 }),
  estimatedUnitPrice: decimal("estimatedUnitPrice", { precision: 15, scale: 2 }),
}, (table) => ({
  rfqIdx: index("rfq_idx").on(table.rfqId),
}));

export const rfqVendors = mysqlTable("rfqVendors", {
  id: int("id").autoincrement().primaryKey(),
  rfqId: int("rfqId").notNull(),
  vendorId: int("vendorId").notNull(),
  status: mysqlEnum("status", ["invited", "responded", "declined"]).default("invited").notNull(),
  invitedAt: timestamp("invitedAt").defaultNow().notNull(),
  respondedAt: timestamp("respondedAt"),
}, (table) => ({
  rfqIdx: index("rfq_idx").on(table.rfqId),
  vendorIdx: index("vendor_idx").on(table.vendorId),
}));

export const rfqResponses = mysqlTable("rfqResponses", {
  id: int("id").autoincrement().primaryKey(),
  rfqId: int("rfqId").notNull(),
  vendorId: int("vendorId").notNull(),
  totalAmount: decimal("totalAmount", { precision: 15, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("XOF"),
  deliveryDays: int("deliveryDays"),
  validUntil: timestamp("validUntil"),
  notes: text("notes"),
  documentUrl: text("documentUrl"),
  scores: json("scores").$type<Record<string, number>>(), // criterion → score
  totalScore: decimal("totalScore", { precision: 5, scale: 2 }),
  isAwarded: boolean("isAwarded").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  rfqIdx: index("rfq_idx").on(table.rfqId),
  vendorIdx: index("vendor_idx").on(table.vendorId),
}));

export const rfqResponseItems = mysqlTable("rfqResponseItems", {
  id: int("id").autoincrement().primaryKey(),
  responseId: int("responseId").notNull(),
  rfqItemId: int("rfqItemId").notNull(),
  unitPrice: decimal("unitPrice", { precision: 15, scale: 2 }).notNull(),
  totalPrice: decimal("totalPrice", { precision: 15, scale: 2 }).notNull(),
  notes: text("notes"),
}, (table) => ({
  responseIdx: index("response_idx").on(table.responseId),
}));

// ============================================================================
// NOTIFICATIONS
// ============================================================================

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  userId: int("userId").notNull(),
  type: varchar("type", { length: 100 }).notNull(), // approval_required, approved, rejected, overdue, contract_expiring, budget_alert, rfq_response
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  entityType: varchar("entityType", { length: 100 }),
  entityId: int("entityId"),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("user_idx").on(table.userId),
  orgIdx: index("org_idx").on(table.organizationId),
  unreadIdx: index("unread_idx").on(table.userId, table.isRead),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type Organization = typeof organizations.$inferSelect;
export type User = typeof users.$inferSelect;
export type Department = typeof departments.$inferSelect;
export type Vendor = typeof vendors.$inferSelect;
export type PurchaseRequest = typeof purchaseRequests.$inferSelect;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
export type Approval = typeof approvals.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type Rfq = typeof rfqs.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
