import type { NotificationCategory } from "../../../events/notificationRequested.event.js";

export const NOTIFICATION_CATEGORY_VALUES = ["orders", "payments", "social", "messages", "promotions", "live"] as const;

export type DevicePlatform = "ios" | "android" | "web";

export interface NotificationRecord {
  readonly id: string;
  readonly userId: string;
  readonly category: NotificationCategory;
  readonly title: string;
  readonly body: string;
  readonly data: Readonly<Record<string, string>>;
  readonly readAt: Date | null;
  readonly createdAt: Date;
}

export type NewNotification = Omit<NotificationRecord, "id" | "readAt" | "createdAt">;

export interface NotificationFilter {
  readonly category?: NotificationCategory;
  readonly unreadOnly?: boolean;
}

export interface DeviceTokenRecord {
  readonly id: string;
  readonly userId: string;
  readonly token: string;
  readonly platform: DevicePlatform;
  readonly createdAt: Date;
}

export interface UnreadNotificationCounts {
  readonly total: number;
  readonly byCategory: Readonly<Record<string, number>>;
}
