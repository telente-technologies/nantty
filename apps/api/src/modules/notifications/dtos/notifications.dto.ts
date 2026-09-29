import { convertCategoryToDisplayCategory, type DisplayNotificationCategory, type NotificationRecord } from "../models/notifications.model.js";

export interface NotificationDto {
  readonly id: string;
  readonly category: DisplayNotificationCategory;
  readonly type: string;
  readonly title: string;
  readonly body: string;
  readonly data: Readonly<Record<string, string>>;
  readonly read: boolean;
  readonly createdAt: string;
}

export function convertNotificationToDto(notification: NotificationRecord): NotificationDto {
  return {
    id: notification.id,
    category: convertCategoryToDisplayCategory(notification.category),
    type: notification.category,
    title: notification.title,
    body: notification.body,
    data: notification.data,
    read: notification.readAt !== null,
    createdAt: notification.createdAt.toISOString(),
  };
}
