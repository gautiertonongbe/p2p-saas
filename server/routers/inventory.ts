import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { TRPCError } from "@trpc/server";
import { createAuditLog } from "../db";

export const inventoryRouter = router({

  listWarehouses: protectedProcedure.query(async ({ ctx }) => {
    const dbInstance = await db.getDb();
    if (!dbInstance) return [];
    const { warehouses } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    return dbInstance.select().from(warehouses).where(eq(warehouses.organizationId, ctx.user.organizationId));
  }),

  createWarehouse: protectedProcedure
    .input(z.object({ code: z.string().min(1), name: z.string().min(1), location: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { warehouses } = await import("../../drizzle/schema");
      const r = await dbInstance.insert(warehouses).values({ ...input, organizationId: ctx.user.organizationId, isActive: true });
      return { id: r[0].insertId };
    }),

  listItems: protectedProcedure
    .input(z.object({ warehouseId: z.number().optional(), lowStock: z.boolean().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return [];
      const { inventoryItems, inventoryStock } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");

      const items = await dbInstance.select().from(inventoryItems)
        .where(eq(inventoryItems.organizationId, ctx.user.organizationId));

      return Promise.all(items.map(async (item) => {
        const stockRows = await dbInstance.select().from(inventoryStock).where(eq(inventoryStock.itemId, item.id));
        const totalQty = stockRows.reduce((s, r) => s + parseFloat(r.quantity), 0);
        const reorderLevel = item.reorderLevel ? parseFloat(item.reorderLevel) : 0;
        const isLowStock = totalQty <= reorderLevel;

        if (input?.lowStock && !isLowStock) return null;
        if (input?.warehouseId) {
          const warehouseStock = stockRows.find(r => r.warehouseId === input.warehouseId);
          return { ...item, totalQuantity: totalQty, isLowStock, warehouseQuantity: parseFloat(warehouseStock?.quantity ?? "0"), stockByWarehouse: stockRows };
        }
        return { ...item, totalQuantity: totalQty, isLowStock, stockByWarehouse: stockRows };
      })).then(r => r.filter(Boolean));
    }),

  createItem: protectedProcedure
    .input(z.object({
      itemCode: z.string().min(1),
      itemName: z.string().min(1),
      description: z.string().optional(),
      unit: z.string().optional(),
      reorderLevel: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "procurement_manager") throw new TRPCError({ code: "FORBIDDEN" });
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { inventoryItems } = await import("../../drizzle/schema");
      const r = await dbInstance.insert(inventoryItems).values({
        ...input,
        organizationId: ctx.user.organizationId,
        reorderLevel: input.reorderLevel?.toString(),
      });
      return { id: r[0].insertId };
    }),

  adjustStock: protectedProcedure
    .input(z.object({
      itemId: z.number(),
      warehouseId: z.number(),
      quantity: z.number(),
      type: z.enum(["in", "out", "adjustment"]),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "procurement_manager") throw new TRPCError({ code: "FORBIDDEN" });
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { inventoryStock, inventoryItems, warehouses } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");

      // Multi-tenancy: verify item and warehouse belong to this org
      const [ownItem] = await dbInstance.select().from(inventoryItems)
        .where(and(eq(inventoryItems.id, input.itemId), eq(inventoryItems.organizationId, ctx.user.organizationId)))
        .limit(1);
      if (!ownItem) throw new TRPCError({ code: "NOT_FOUND", message: "Item not found in your organisation" });

      const [ownWh] = await dbInstance.select().from(warehouses)
        .where(and(eq(warehouses.id, input.warehouseId), eq(warehouses.organizationId, ctx.user.organizationId)))
        .limit(1);
      if (!ownWh) throw new TRPCError({ code: "NOT_FOUND", message: "Warehouse not found in your organisation" });

      const [existing] = await dbInstance.select().from(inventoryStock)
        .where(and(eq(inventoryStock.itemId, input.itemId), eq(inventoryStock.warehouseId, input.warehouseId)))
        .limit(1);

      const currentQty = parseFloat(existing?.quantity ?? "0");
      const newQty = input.type === "adjustment"
        ? input.quantity
        : input.type === "in" ? currentQty + input.quantity : Math.max(0, currentQty - input.quantity);

      if (existing) {
        await dbInstance.update(inventoryStock)
          .set({ quantity: newQty.toString() })
          .where(eq(inventoryStock.id, existing.id));
      } else {
        await dbInstance.insert(inventoryStock).values({
          itemId: input.itemId,
          warehouseId: input.warehouseId,
          quantity: newQty.toString(),
        });
      }

      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "inventoryStock",
        entityId: input.itemId,
        action: `stock_${input.type}`,
        actorId: ctx.user.id,
        oldValue: { quantity: currentQty },
        newValue: { quantity: newQty, warehouseId: input.warehouseId, notes: input.notes },
      });

      return { success: true, newQuantity: newQty };
    }),

  getLowStockAlerts: protectedProcedure.query(async ({ ctx }) => {
    const dbInstance = await db.getDb();
    if (!dbInstance) return [];
    const { inventoryItems, inventoryStock } = await import("../../drizzle/schema");
    const { eq, and } = await import("drizzle-orm");

    const items = await dbInstance.select().from(inventoryItems)
      .where(eq(inventoryItems.organizationId, ctx.user.organizationId));

    const alerts = [];
    for (const item of items) {
      if (!item.reorderLevel) continue;
      const stockRows = await dbInstance.select().from(inventoryStock).where(eq(inventoryStock.itemId, item.id));
      const total = stockRows.reduce((s, r) => s + parseFloat(r.quantity), 0);
      if (total <= parseFloat(item.reorderLevel)) {
        alerts.push({ ...item, currentQuantity: total, reorderLevel: parseFloat(item.reorderLevel) });
      }
    }
    return alerts;
  }),
});
