import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { purchaseRequestsRouter } from "./routers/purchaseRequests";
import { approvalsRouter } from "./routers/approvals";
import { purchaseOrdersRouter } from "./routers/purchaseOrders";
import { vendorsRouter } from "./routers/vendors";
import { invoicesRouter } from "./routers/invoices";
import { budgetsRouter } from "./routers/budgets";
import { aiInsightsRouter } from "./routers/aiInsights";
import { settingsRouter } from "./routers/settings";
import { rfqsRouter } from "./routers/rfqs";
import { notificationsRouter } from "./routers/notificationsRouter";
import { inventoryRouter } from "./routers/inventory";
import { reportsRouter } from "./routers/reports";
import { viewsRouter } from "./routers/views";

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // P2P Platform Routers
  purchaseRequests: purchaseRequestsRouter,
  approvals: approvalsRouter,
  purchaseOrders: purchaseOrdersRouter,
  vendors: vendorsRouter,
  invoices: invoicesRouter,
  budgets: budgetsRouter,
  aiInsights: aiInsightsRouter,
  settings: settingsRouter,
  rfqs: rfqsRouter,
  notifications: notificationsRouter,
  inventory: inventoryRouter,
  reports: reportsRouter,
  views: viewsRouter,
});

export type AppRouter = typeof appRouter;
