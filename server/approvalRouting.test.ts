import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { users, purchaseRequests, approvals, organizations } from "../drizzle/schema";
import { eq } from "drizzle-orm";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

describe("Approval Routing System", () => {
  let testOrgId: number;
  let testUserId: number;
  let managerUserId: number;
  let financeUserId: number;
  let adminUserId: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Get the latest seeded organization
    const orgs = await db.select().from(organizations).orderBy(organizations.id);
    if (orgs.length === 0) throw new Error("No organization found - run seed script first");
    testOrgId = orgs[orgs.length - 1]!.id;

    // Get or create test users with different roles
    let requester = await db.select().from(users).where(eq(users.openId, "test-requester")).limit(1);
    if (requester.length === 0) {
      const requesterResult = await db.insert(users).values({
        openId: "test-requester",
        organizationId: testOrgId,
        name: "Test Requester",
        email: "requester@test.com",
        role: "requester",
        loginMethod: "test",
      });
      testUserId = requesterResult[0].insertId;
    } else {
      testUserId = requester[0]!.id;
    }

    let manager = await db.select().from(users).where(eq(users.openId, "test-manager")).limit(1);
    if (manager.length === 0) {
      const managerResult = await db.insert(users).values({
        openId: "test-manager",
        organizationId: testOrgId,
        name: "Test Manager",
        email: "manager@test.com",
        role: "procurement_manager",
        loginMethod: "test",
      });
      managerUserId = managerResult[0].insertId;
    } else {
      managerUserId = manager[0]!.id;
    }

    let finance = await db.select().from(users).where(eq(users.openId, "test-finance")).limit(1);
    if (finance.length === 0) {
      const financeResult = await db.insert(users).values({
        openId: "test-finance",
        organizationId: testOrgId,
        name: "Test Finance",
        email: "finance@test.com",
        role: "approver",
        loginMethod: "test",
      });
      financeUserId = financeResult[0].insertId;
    } else {
      financeUserId = finance[0]!.id;
    }

    let admin = await db.select().from(users).where(eq(users.openId, "test-admin")).limit(1);
    if (admin.length === 0) {
      const adminResult = await db.insert(users).values({
        openId: "test-admin",
        organizationId: testOrgId,
        name: "Test Admin",
        email: "admin@test.com",
        role: "admin",
        loginMethod: "test",
      });
      adminUserId = adminResult[0].insertId;
    } else {
      adminUserId = admin[0]!.id;
    }
  });

  function createContext(userId: number): { ctx: TrpcContext } {
    const user: AuthenticatedUser = {
      id: userId,
      openId: `test-user-${userId}`,
      email: `user${userId}@test.com`,
      name: `Test User ${userId}`,
      loginMethod: "test",
      role: "requester",
      organizationId: testOrgId,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      departmentId: null,
      approvalLimit: null,
      status: "active",
    };

    const ctx: TrpcContext = {
      user,
      req: {
        protocol: "https",
        headers: {},
      } as TrpcContext["req"],
      res: {
        clearCookie: () => {},
      } as TrpcContext["res"],
    };

    return { ctx };
  }

  it("should create approval chain for low-amount request (< 500k XOF)", async () => {
    const { ctx } = createContext(testUserId);
    const caller = appRouter.createCaller(ctx);

    // Create a purchase request
    const createResult = await caller.purchaseRequests.create({
      title: "Low Amount Test Request",
      description: "Testing approval routing for low amount",
      amountEstimate: 300000, // 300k XOF - should trigger Policy 1
      taxIncluded: false,
      urgencyLevel: "medium",
      items: [
        {
          itemName: "Test Item",
          quantity: 1,
          unitPrice: 300000,
        },
      ],
    });

    // Submit the request
    await caller.purchaseRequests.submit({ id: createResult.id });

    // Check that approvals were created
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const createdApprovals = await db
      .select()
      .from(approvals)
      .where(eq(approvals.requestId, createResult.id));

    // Should have 1 approval (manager only)
    expect(createdApprovals.length).toBeGreaterThan(0);
    expect(createdApprovals[0]?.stepOrder).toBe(1);

    // Check request status
    const request = await db
      .select()
      .from(purchaseRequests)
      .where(eq(purchaseRequests.id, createResult.id))
      .limit(1);

    expect(request[0]?.status).toBe("pending_approval");
  });

  it("should create approval chain for medium-amount request (500k-2M XOF)", async () => {
    const { ctx } = createContext(testUserId);
    const caller = appRouter.createCaller(ctx);

    // Create a purchase request
    const createResult = await caller.purchaseRequests.create({
      title: "Medium Amount Test Request",
      description: "Testing approval routing for medium amount",
      amountEstimate: 1000000, // 1M XOF - should trigger Policy 2
      taxIncluded: false,
      urgencyLevel: "medium",
      items: [
        {
          itemName: "Test Item",
          quantity: 1,
          unitPrice: 1000000,
        },
      ],
    });

    // Submit the request
    await caller.purchaseRequests.submit({ id: createResult.id });

    // Check that approvals were created
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const createdApprovals = await db
      .select()
      .from(approvals)
      .where(eq(approvals.requestId, createResult.id));

    // Should have 2 approvals (manager + finance)
    expect(createdApprovals.length).toBeGreaterThanOrEqual(2);
    
    const stepOrders = createdApprovals.map((a) => a.stepOrder).sort();
    expect(stepOrders).toContain(1);
    expect(stepOrders).toContain(2);
  });

  it("should create approval chain for high-amount request (> 2M XOF)", async () => {
    const { ctx } = createContext(testUserId);
    const caller = appRouter.createCaller(ctx);

    // Create a purchase request
    const createResult = await caller.purchaseRequests.create({
      title: "High Amount Test Request",
      description: "Testing approval routing for high amount",
      amountEstimate: 3000000, // 3M XOF - should trigger Policy 3
      taxIncluded: false,
      urgencyLevel: "high",
      items: [
        {
          itemName: "Test Item",
          quantity: 1,
          unitPrice: 3000000,
        },
      ],
    });

    // Submit the request
    await caller.purchaseRequests.submit({ id: createResult.id });

    // Check that approvals were created
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const createdApprovals = await db
      .select()
      .from(approvals)
      .where(eq(approvals.requestId, createResult.id));

    // Should have 3 approvals (manager + finance + admin)
    expect(createdApprovals.length).toBeGreaterThanOrEqual(3);
    
    const stepOrders = createdApprovals.map((a) => a.stepOrder).sort();
    expect(stepOrders).toContain(1);
    expect(stepOrders).toContain(2);
    expect(stepOrders).toContain(3);
  });
});
