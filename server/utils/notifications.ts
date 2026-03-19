/**
 * In-app Notification System
 * Creates notification records that users see in the bell icon.
 */

import { getDb } from "../db";
import { notifications } from "../../drizzle/schema";

export type NotificationType =
  | "approval_required"
  | "approved"
  | "rejected"
  | "approval_overdue"
  | "contract_expiring"
  | "budget_alert"
  | "rfq_response"
  | "payment_processed"
  | "invoice_overdue";

export async function createNotification(opts: {
  organizationId: number;
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string;
  entityId?: number;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    await db.insert(notifications).values({
      organizationId: opts.organizationId,
      userId: opts.userId,
      type: opts.type,
      title: opts.title,
      message: opts.message,
      entityType: opts.entityType,
      entityId: opts.entityId,
      isRead: false,
    });
  } catch (err) {
    // Non-fatal — never block a business operation for a notification failure
    console.warn("[Notifications] Failed to create notification:", (err as Error).message);
  }
}

export async function createNotificationForMany(opts: {
  organizationId: number;
  userIds: number[];
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string;
  entityId?: number;
}): Promise<void> {
  await Promise.all(
    opts.userIds.map(userId =>
      createNotification({ ...opts, userId })
    )
  );
}
