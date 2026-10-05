import { randomUUID } from "node:crypto";

import type { StoredNotification } from "../interfaces/repositories.interface.js";
import { convertNotificationToResponse } from "../modules/inbox/dtos/notification.dto.js";

export const notificationCreatedEventType = "notification.created";

export interface OutboxRow {
  readonly id: string;
  readonly eventType: string;
  readonly subject: string;
  readonly payload: Record<string, unknown>;
}

export function buildNotificationCreatedOutboxRow(notification: StoredNotification, webBaseUrl?: string): OutboxRow {
  const id = randomUUID();
  return {
    id,
    eventType: notificationCreatedEventType,
    subject: notification.userId,
    payload: {
      id,
      type: notificationCreatedEventType,
      source: "notifications",
      subject: notification.userId,
      schemaVersion: 1,
      occurredAt: notification.createdAt.toISOString(),
      data: { accountId: notification.userId, notificationId: notification.id, notification: convertNotificationToResponse(notification, webBaseUrl) },
    },
  };
}
