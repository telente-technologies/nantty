import { defineEvent } from "@zudojs/events";

export type NotificationCategory = "orders" | "payments" | "social" | "messages" | "promotions" | "live";

export interface NotificationRequestedPayload {
  readonly userId: string;
  readonly category: NotificationCategory;
  readonly title: string;
  readonly body: string;
  readonly data?: Readonly<Record<string, string>>;
}

export const NotificationRequestedEvent = defineEvent<"notifications.requested", NotificationRequestedPayload>("notifications.requested");
