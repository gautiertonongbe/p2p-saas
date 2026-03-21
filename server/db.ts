import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  users, organizations, departments, vendors, purchaseRequests, purchaseRequestItems,
  purchaseOrders, purchaseOrderItems, invoices, budgets, approvals, approvalPolicies,
  approvalSteps, lookupTypes, lookupValues, auditLogs, receipts, receiptItems, payments,
  warehouses, inventoryItems, inventoryStock, vendorContracts, savedViews,
  type User, type Organization, type PurchaseRequest, type PurchaseOrder, type Invoice
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;
let _connectionAttempts = 0;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 2000;

export async function getDb() {
  if (_db) return _db;
  if (!process.env.DATABASE_URL) return null;
  if (_connectionAttempts >= MAX_RETRY_ATTEMPTS) {
    // After max retries, allow retry after 30s
    setTimeout(() => { _connectionAttempts = 0; }, 30_000);
    return null;
  }

  _connectionAttempts++;
  try {
    _db = drizzle(process.env.DATABASE_URL);
    // Verify connection with lightweight query
    await _db.execute(sql`SELECT 1`);
    _connectionAttempts = 0;
    console.log("[Database] Connected successfully");
  } catch (error) {
    console.warn(`[Database] Connection attempt ${_connectionAttempts}/${MAX_RETRY_ATTEMPTS} failed:`, (error as Error).message);
    _db = null;
    if (_connectionAttempts < MAX_RETRY_ATTEMPTS) {
      await new Promise(resolve => setTimeout(resolve, RETRY_BACKOFF_MS * _connectionAttempts));
    }
  }
  return _db;
}

// ============================================================================
// USER MANAGEMENT
// ============================================================================

export async function upsertUser(user: {
  openId: string;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
  organizationId: number;
  role?: "admin" | "procurement_manager" | "approver" | "requester";
  lastSignedIn?: Date;
}): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: any = {
      openId: user.openId,
      organizationId: user.organizationId,
    };
    const updateSet: Record<string, unknown> = {};

    if (user.name !== undefined) {
      values.name = user.name;
      updateSet.name = user.name;
    }
    if (user.email !== undefined) {
      values.email = user.email;
      updateSet.email = user.email;
    }
    if (user.loginMethod !== undefined) {
      values.loginMethod = user.loginMethod;
      updateSet.loginMethod = user.loginMethod;
    }
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUsersByOrganization(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).where(eq(users.organizationId, organizationId));
}

// ============================================================================
// ORGANIZATION MANAGEMENT
// ============================================================================

export async function getOrganizationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createOrganization(data: {
  legalName: string;
  tradeName?: string;
  country: "Benin" | "Côte d'Ivoire";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(organizations).values(data);
  return result[0].insertId;
}

// ============================================================================
// PURCHASE REQUISITIONS
// ============================================================================

export async function getPurchaseRequests(organizationId: number, filters?: {
  status?: string;
  requesterId?: number;
  departmentId?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(purchaseRequests.organizationId, organizationId)];

  if (filters?.status) {
    conditions.push(eq(purchaseRequests.status, filters.status as any));
  }
  if (filters?.requesterId) {
    conditions.push(eq(purchaseRequests.requesterId, filters.requesterId));
  }
  if (filters?.departmentId) {
    conditions.push(eq(purchaseRequests.departmentId, filters.departmentId));
  }

  return db.select().from(purchaseRequests)
    .where(and(...conditions))
    .orderBy(desc(purchaseRequests.createdAt))
    .limit(200);
}

export async function getPurchaseRequestById(id: number, organizationId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(purchaseRequests)
    .where(and(eq(purchaseRequests.id, id), eq(purchaseRequests.organizationId, organizationId)))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

export async function createPurchaseRequest(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(purchaseRequests).values(data);
  return result[0].insertId;
}

export async function updatePurchaseRequest(id: number, organizationId: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(purchaseRequests)
    .set(data)
    .where(and(eq(purchaseRequests.id, id), eq(purchaseRequests.organizationId, organizationId)));
}

// ============================================================================
// PURCHASE ORDERS
// ============================================================================

export async function getPurchaseOrders(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(purchaseOrders)
    .where(eq(purchaseOrders.organizationId, organizationId))
    .orderBy(desc(purchaseOrders.createdAt))
    .limit(200);
}

export async function getPurchaseOrderById(id: number, organizationId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(purchaseOrders)
    .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.organizationId, organizationId)))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

export async function createPurchaseOrder(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(purchaseOrders).values(data);
  return result[0].insertId;
}

// ============================================================================
// VENDORS
// ============================================================================

export async function getVendors(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(vendors)
    .where(eq(vendors.organizationId, organizationId))
    .orderBy(vendors.legalName);
}

export async function getVendorById(id: number, organizationId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(vendors)
    .where(and(eq(vendors.id, id), eq(vendors.organizationId, organizationId)))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

export async function createVendor(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(vendors).values(data);
  return result[0].insertId;
}

// ============================================================================
// INVOICES
// ============================================================================

export async function getInvoices(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(invoices)
    .where(eq(invoices.organizationId, organizationId))
    .orderBy(desc(invoices.createdAt))
    .limit(200);
}

export async function getInvoiceById(id: number, organizationId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.organizationId, organizationId)))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

export async function createInvoice(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(invoices).values(data);
  return result[0].insertId;
}

// ============================================================================
// BUDGETS
// ============================================================================

export async function getBudgets(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(budgets)
    .where(eq(budgets.organizationId, organizationId));
}

export async function getBudgetByScope(organizationId: number, scopeType: string, scopeId: number, fiscalPeriod: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(budgets)
    .where(and(
      eq(budgets.organizationId, organizationId),
      eq(budgets.scopeType, scopeType as any),
      eq(budgets.scopeId, scopeId),
      eq(budgets.fiscalPeriod, fiscalPeriod)
    ))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

// ============================================================================
// APPROVALS
// ============================================================================

export async function getApprovalsByRequest(requestId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(approvals)
    .where(eq(approvals.requestId, requestId))
    .orderBy(approvals.stepOrder);
}

export async function getPendingApprovals(approverId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(approvals)
    .where(and(eq(approvals.approverId, approverId), eq(approvals.decision, "pending")))
    .orderBy(desc(approvals.createdAt));
}

export async function createApproval(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(approvals).values(data);
  return result[0].insertId;
}

export async function updateApproval(id: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(approvals).set(data).where(eq(approvals.id, id));
}

// ============================================================================
// AUDIT LOGS
// ============================================================================

export async function createAuditLog(data: {
  organizationId: number;
  entityType: string;
  entityId: number;
  action: string;
  actorId: number;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
  userAgent?: string;
}) {
  if (!data.entityId || isNaN(data.entityId)) return; // Guard against NaN
  const db = await getDb();
  if (!db) return;
  
  try {
    await db.insert(auditLogs).values(data);
  } catch (e) {
    console.error("createAuditLog error:", e);
  }
}

export async function getAuditLogs(organizationId: number, entityType?: string, entityId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  let conditions = [eq(auditLogs.organizationId, organizationId)];
  if (entityType) conditions.push(eq(auditLogs.entityType, entityType));
  if (entityId) conditions.push(eq(auditLogs.entityId, entityId));
  
  return db.select().from(auditLogs)
    .where(and(...conditions))
    .orderBy(desc(auditLogs.timestamp))
    .limit(100);
}

// ============================================================================
// LOOKUP FRAMEWORK
// ============================================================================

export async function getLookupTypes(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(lookupTypes)
    .where(eq(lookupTypes.organizationId, organizationId));
}

export async function getLookupValues(lookupTypeId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(lookupValues)
    .where(eq(lookupValues.lookupTypeId, lookupTypeId));
}

export async function createLookupType(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(lookupTypes).values(data);
  return result[0].insertId;
}

export async function createLookupValue(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(lookupValues).values(data);
  return result[0].insertId;
}
