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

export const DISPLAY_NOTIFICATION_CATEGORIES = ["orders", "social", "system"] as const;
export type DisplayNotificationCategory = (typeof DISPLAY_NOTIFICATION_CATEGORIES)[number];

const DISPLAY_CATEGORY_BY_CATEGORY: Readonly<Record<NotificationCategory, DisplayNotificationCategory>> = {
  orders: "orders",
  payments: "orders",
  social: "social",
  messages: "social",
  live: "social",
  promotions: "system",
};

export function convertCategoryToDisplayCategory(category: NotificationCategory): DisplayNotificationCategory {
  return DISPLAY_CATEGORY_BY_CATEGORY[category] ?? "system";
}

export function listCategoriesForDisplayCategory(displayCategory: DisplayNotificationCategory): readonly NotificationCategory[] {
  return NOTIFICATION_CATEGORY_VALUES.filter((category) => DISPLAY_CATEGORY_BY_CATEGORY[category] === displayCategory);
}

export interface NotificationFilter {
  readonly categories?: readonly NotificationCategory[];
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
