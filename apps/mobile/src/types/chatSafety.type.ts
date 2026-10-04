import type { ID, ISODate } from "./models.type";

export type InboxFolder = "chats" | "requests" | "spam";

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

export interface LinkPreview {
  readonly url: string;
  readonly domain: string;
  readonly title: string;
  readonly description: string | null;
  readonly imageUrl: string | null;
  readonly siteName?: string | null;
  readonly imageMediaId?: string | null;
}

export type SharedContentKind = "post" | "clip" | "product" | "live" | "store" | "profile";

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

export interface MessageEncryptionEnvelope {
  readonly deviceId: string;
  readonly ciphertext: string | null;
  readonly protocol: "signal-v1-pending";
}

export type ChatStreakState = "none" | "active" | "broken";

export interface ChatStreak {
  readonly count: number;
  readonly state: ChatStreakState;
  readonly hourglass: boolean;
  readonly secondsUntilMyDayEnds: number;
  readonly sentToday: { readonly me: boolean; readonly peer: boolean };
  readonly restoresRemaining: number;
  readonly restoresPerMonth: number;
  readonly restorableUntil: ISODate | null;
  readonly countBeforeBreak: number;
  readonly milestoneDays: number | null;
  readonly milestoneCelebrationPending: boolean;
}

export interface SendToChatsInput {
  readonly conversationIds: readonly ID[];
  readonly reference: SharedContentReference;
  readonly note: string;
}

export interface SendToChatsResult {
  readonly sentCount: number;
  readonly shareCount: number;
}
