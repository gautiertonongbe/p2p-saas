import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createTestContext(role: "admin" | "procurement_manager" | "approver" | "requester" = "requester"): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    organizationId: 1,
    departmentId: 1,
    role,
    approvalLimit: null,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("Purchase Requests", () => {
  it("should list purchase requests for organization", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.purchaseRequests.list();

    expect(Array.isArray(result)).toBe(true);
  });

  it("should create a purchase request with items", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const requestData = {
      title: "Test Purchase Request",
      description: "Test description",
      amountEstimate: 50000,
      taxIncluded: false,
      urgencyLevel: "medium" as const,
      items: [
        {
          itemName: "Laptop",
          description: "Dell Latitude",
          quantity: 2,
          unitPrice: 25000,
          unit: "pcs",
        },
      ],
    };

    const result = await caller.purchaseRequests.create(requestData);

    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("requestNumber");
    expect(result.requestNumber).toMatch(/^PR-/);
  });

  it("should get purchase request by id", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    // First create a request
    const created = await caller.purchaseRequests.create({
      title: "Test Request for Retrieval",
      amountEstimate: 10000,
      urgencyLevel: "low" as const,
      items: [
        {
          itemName: "Test Item",
          quantity: 1,
          unitPrice: 10000,
        },
      ],
    });

    // Then retrieve it
    const retrieved = await caller.purchaseRequests.getById({ id: created.id });

    expect(retrieved).toBeDefined();
    expect(retrieved.id).toBe(created.id);
    expect(retrieved.title).toBe("Test Request for Retrieval");
  });

  it("should update a draft purchase request", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    // Create a draft request
    const created = await caller.purchaseRequests.create({
      title: "Draft Request",
      amountEstimate: 5000,
      urgencyLevel: "medium" as const,
      items: [
        {
          itemName: "Item",
          quantity: 1,
          unitPrice: 5000,
        },
      ],
    });

    // Update it
    const updateResult = await caller.purchaseRequests.update({
      id: created.id,
      title: "Updated Draft Request",
      urgencyLevel: "high" as const,
    });

    expect(updateResult.success).toBe(true);

    // Verify update
    const updated = await caller.purchaseRequests.getById({ id: created.id });
    expect(updated.title).toBe("Updated Draft Request");
    expect(updated.urgencyLevel).toBe("high");
  });

  it("should get user's own requests", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    // Create a request
    await caller.purchaseRequests.create({
      title: "My Request",
      amountEstimate: 1000,
      urgencyLevel: "low" as const,
      items: [
        {
          itemName: "Test",
          quantity: 1,
          unitPrice: 1000,
        },
      ],
    });

    const myRequests = await caller.purchaseRequests.getMyRequests();

    expect(Array.isArray(myRequests)).toBe(true);
    expect(myRequests.length).toBeGreaterThan(0);
    expect(myRequests.every(r => r.requesterId === ctx.user.id)).toBe(true);
  });

  it("should get request items", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const created = await caller.purchaseRequests.create({
      title: "Request with Items",
      amountEstimate: 15000,
      urgencyLevel: "medium" as const,
      items: [
        {
          itemName: "Item 1",
          quantity: 2,
          unitPrice: 5000,
        },
        {
          itemName: "Item 2",
          quantity: 1,
          unitPrice: 5000,
        },
      ],
    });

    const items = await caller.purchaseRequests.getRequestItems({ requestId: created.id });

    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBe(2);
    expect(items[0].itemName).toBe("Item 1");
    expect(items[1].itemName).toBe("Item 2");
  });
});

describe("Approvals", () => {
  it("should get pending approvals for user", async () => {
    const ctx = createTestContext("approver");
    const caller = appRouter.createCaller(ctx);

    const result = await caller.approvals.myPendingApprovals();

    expect(Array.isArray(result)).toBe(true);
  });

  it("should get approval policies", async () => {
    const ctx = createTestContext("admin");
    const caller = appRouter.createCaller(ctx);

    const policies = await caller.approvals.getPolicies();

    expect(Array.isArray(policies)).toBe(true);
  });
});
