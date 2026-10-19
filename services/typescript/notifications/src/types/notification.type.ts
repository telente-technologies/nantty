import type { EmailTemplateKey } from "@zudomart/email-templates";

export type InboxCategory = "orders" | "social" | "system";
export type InboxKind = "mention" | "videoReply" | "quote" | "repost" | "followRequest" | "followRequestAccepted";
export type MailKind = "transactional" | "security" | "legal" | "marketing";
export type DeliveryChannel = "in_app" | "email" | "push" | "fanout";
export type DeliveryStatus = "pending" | "sent" | "skipped" | "failed";

export interface ActorSummary {
  readonly id: string;
  readonly name: string;
  readonly username?: string;
  readonly avatarUrl?: string | null;
  readonly verified?: boolean;
}

export interface InAppContent {
  readonly category: InboxCategory;
  readonly kind?: InboxKind;
  readonly title: string;
  readonly body: string;
  readonly actor?: ActorSummary | null;
  readonly data?: Readonly<Record<string, unknown>>;
}

export interface PushContent {
  readonly title: string;
  readonly body: string;
  readonly data?: Readonly<Record<string, unknown>>;
}

export interface Recipient {
  readonly accountId: string;
  readonly email: string | null;
  readonly emailVerified: boolean;
  readonly firstName: string;
  readonly username: string;
  readonly marketingConsent: boolean;
  readonly status: string;
  readonly pushEnabled?: boolean;
  readonly marketingFrequency?: MarketingFrequency;
}

export type MarketingFrequency = "weekly" | "important_only" | "off";

export interface EmailPlan {
  readonly templateKey: EmailTemplateKey;
  readonly props: unknown;
  readonly deliverIfUnreadAfterMinutes?: number;
}

export interface NotificationIntent {
  readonly eventId: string;
  readonly recipientUserId: string;
  readonly variant?: string;
  readonly preferenceCategory: PreferenceCategory;
  readonly inApp?: InAppContent;
  readonly push?: PushContent;
  readonly email?: (recipient: Recipient) => EmailPlan;
  readonly emailAddressOverride?: string;
}

export type PreferenceCategory =
  | "auth"
  | "orders"
  | "escrow"
  | "seller"
  | "payments"
  | "creator"
  | "checkmarks"
  | "social"
  | "milestones"
  | "live"
  | "trust"
  | "privacy"
  | "support"
  | "marketing";
