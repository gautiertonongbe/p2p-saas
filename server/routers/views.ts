import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { TRPCError } from "@trpc/server";
import { createAuditLog } from "../db";

const filterSchema = z.object({
  field: z.string(),
  operator: z.string(),
  value: z.string(),
  label: z.string().optional(),
});

const viewDefinitionSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  entity: z.string().min(1),
  filters: z.array(filterSchema).default([]),
  columns: z.array(z.string()).optional(),
  sortBy: z.string().optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  displayType: z.enum(["table", "cards", "compact"]).default("table"),
  isShared: z.boolean().default(false),
  isDefault: z.boolean().default(false),
});

export const viewsRouter = router({

  // List views for a specific entity (own + shared org views)
  list: protectedProcedure
    .input(z.object({ entity: z.string() }))
    .query(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return [];

      const { savedViews } = await import("../../drizzle/schema");
      const { eq, and, or } = await import("drizzle-orm");

      // Return: user's own views OR views shared with the org
      const rows = await dbInstance.select().from(savedViews)
        .where(and(
          eq(savedViews.organizationId, ctx.user.organizationId),
          eq(savedViews.entity, input.entity),
          or(
            eq(savedViews.userId, ctx.user.id),
            eq(savedViews.isShared, true)
          )
        ))
        .orderBy(savedViews.isDefault, savedViews.name);

      return rows.map(v => ({
        ...v,
        isOwner: v.userId === ctx.user.id,
      }));
    }),

  // Get single view
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { savedViews } = await import("../../drizzle/schema");
      const { eq, and, or } = await import("drizzle-orm");

      const [view] = await dbInstance.select().from(savedViews)
        .where(and(
          eq(savedViews.id, input.id),
          eq(savedViews.organizationId, ctx.user.organizationId),
          or(eq(savedViews.userId, ctx.user.id), eq(savedViews.isShared, true))
        ))
        .limit(1);

      if (!view) throw new TRPCError({ code: "NOT_FOUND" });
      return { ...view, isOwner: view.userId === ctx.user.id };
    }),

  // Create a new view
  create: protectedProcedure
    .input(viewDefinitionSchema)
    .mutation(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { savedViews } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");

      // If setting as default, clear existing defaults for this entity+user
      if (input.isDefault) {
        await dbInstance.update(savedViews)
          .set({ isDefault: false })
          .where(and(
            eq(savedViews.organizationId, ctx.user.organizationId),
            eq(savedViews.userId, ctx.user.id),
            eq(savedViews.entity, input.entity)
          ));
      }

      const r = await dbInstance.insert(savedViews).values({
        organizationId: ctx.user.organizationId,
        userId: ctx.user.id,
        entity: input.entity,
        name: input.name,
        description: input.description,
        filters: input.filters,
        columns: input.columns,
        sortBy: input.sortBy,
        sortDir: input.sortDir,
        displayType: input.displayType,
        isShared: input.isShared,
        isDefault: input.isDefault,
      });

      const newId = Number((r as any).insertId);

      await createAuditLog({
        organizationId: ctx.user.organizationId,
        entityType: "savedView",
        entityId: newId,
        action: "created",
        actorId: ctx.user.id,
        newValue: { name: input.name, entity: input.entity, isShared: input.isShared },
      });

      return { id: newId };
    }),

  // Update a view (owner only, or admin)
  update: protectedProcedure
    .input(viewDefinitionSchema.extend({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { savedViews } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");

      // Verify ownership (admins can update any view)
      const [existing] = await dbInstance.select().from(savedViews)
        .where(and(eq(savedViews.id, input.id), eq(savedViews.organizationId, ctx.user.organizationId)))
        .limit(1);

      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (existing.userId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Seul le créateur ou un administrateur peut modifier cette vue" });
      }

      // Clear other defaults if setting this as default
      if (input.isDefault) {
        await dbInstance.update(savedViews)
          .set({ isDefault: false })
          .where(and(
            eq(savedViews.organizationId, ctx.user.organizationId),
            eq(savedViews.entity, input.entity)
          ));
      }

      const { id, ...data } = input;
      await dbInstance.update(savedViews)
        .set({ ...data, filters: data.filters, columns: data.columns })
        .where(eq(savedViews.id, id));

      return { success: true };
    }),

  // Delete a view (owner only, or admin)
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { savedViews } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");

      const [existing] = await dbInstance.select().from(savedViews)
        .where(and(eq(savedViews.id, input.id), eq(savedViews.organizationId, ctx.user.organizationId)))
        .limit(1);

      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (existing.userId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Seul le créateur ou un administrateur peut supprimer cette vue" });
      }

      await dbInstance.delete(savedViews).where(eq(savedViews.id, input.id));
      return { success: true };
    }),

  // Set a view as default for the current user
  setDefault: protectedProcedure
    .input(z.object({ id: z.number(), entity: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { savedViews } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");

      // Clear existing defaults for this entity + user
      await dbInstance.update(savedViews)
        .set({ isDefault: false })
        .where(and(
          eq(savedViews.organizationId, ctx.user.organizationId),
          eq(savedViews.userId, ctx.user.id),
          eq(savedViews.entity, input.entity)
        ));

      // Set new default
      await dbInstance.update(savedViews)
        .set({ isDefault: true })
        .where(and(eq(savedViews.id, input.id), eq(savedViews.organizationId, ctx.user.organizationId)));

      return { success: true };
    }),

  // Duplicate a view
  duplicate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { savedViews } = await import("../../drizzle/schema");
      const { eq, and, or } = await import("drizzle-orm");

      const [original] = await dbInstance.select().from(savedViews)
        .where(and(
          eq(savedViews.id, input.id),
          eq(savedViews.organizationId, ctx.user.organizationId),
          or(eq(savedViews.userId, ctx.user.id), eq(savedViews.isShared, true))
        ))
        .limit(1);

      if (!original) throw new TRPCError({ code: "NOT_FOUND" });

      const r = await dbInstance.insert(savedViews).values({
        organizationId: ctx.user.organizationId,
        userId: ctx.user.id,
        entity: original.entity,
        name: `Copie de ${original.name}`,
        description: original.description,
        filters: original.filters,
        columns: original.columns,
        sortBy: original.sortBy,
        sortDir: original.sortDir,
        displayType: original.displayType,
        isShared: false,   // copies are private by default
        isDefault: false,
      });

      return { id: Number((r as any).insertId) };
    }),
});
