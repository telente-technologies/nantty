import type { ID } from "./models.type";

export type InboxFolder = "chats" | "requests" | "spam";

export type SharedContentKind = "post" | "clip" | "story" | "product" | "live" | "store" | "profile" | "order";

export interface SharedContentReference {
  readonly kind: SharedContentKind;
  readonly id: ID;
}

export type SharedContentAvailability = "available" | "private" | "unavailable";

export interface SharedContentCard {
  readonly reference: SharedContentReference;
  readonly availability: SharedContentAvailability;
  readonly title: string;
  readonly subtitle: string | null;
  readonly imageUrl: string | null;
  readonly priceLabel?: string | null;
  readonly stock?: number | null;
  readonly isLive?: boolean;
  readonly viewerCount?: number | null;
  readonly followsAuthor?: boolean | null;
  readonly profileUserId?: ID | null;
}

export type MessageRequestAudience = "everyone" | "following" | "followers" | "nobody";

export type ChatMuteDuration = "8h" | "1w" | "always" | "off";

export interface ChatNotificationSettings {
  readonly messages: boolean;
  readonly requests: boolean;
  readonly groups: boolean;
  readonly streakReminders: boolean;
  readonly showMessagePreview: boolean;
}

export interface ChatSettings {
  readonly messageRequestsFrom: MessageRequestAudience;
  readonly notifications: ChatNotificationSettings;
}
