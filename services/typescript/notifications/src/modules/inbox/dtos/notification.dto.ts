import type { StoredNotification } from "../../../interfaces/repositories.interface.js";

export interface NotificationResponse {
  readonly id: string;
  readonly category: string;
  readonly kind?: string;
  readonly title: string;
  readonly body: string;
  readonly createdAt: string;
  readonly read: boolean;
  readonly actor: StoredNotification["actor"];
}

export function convertNotificationToResponse(notification: StoredNotification): NotificationResponse {
  return {
    id: notification.id,
    category: notification.category,
    ...(notification.kind === null ? {} : { kind: notification.kind }),
    title: notification.title,
    body: notification.body,
    createdAt: notification.createdAt.toISOString(),
    read: notification.readAt !== null,
    actor: notification.actor,
  };
}
