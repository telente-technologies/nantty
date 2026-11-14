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
  readonly sound: boolean;
  readonly vibration: boolean;
  readonly bubbles: boolean;
  readonly bubbleMode: "all" | "selected";
  readonly bubbleConversationIds: readonly ID[];
  readonly bubbleExcludedConversationIds: readonly ID[];
}

export interface ChatSettings {
  readonly messageRequestsFrom: MessageRequestAudience;
  readonly preventDirectGroupAdds: boolean;
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

export type SharedContentKind = "post" | "clip" | "product" | "live" | "space" | "store" | "profile" | "order";

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
  readonly protocol: string;
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
  readonly encryptions?: readonly { readonly conversationId: ID; readonly deviceId: string; readonly ciphertext: string }[];
}

export interface SendToChatsResult {
  readonly sentCount: number;
  readonly shareCount: number;
}
