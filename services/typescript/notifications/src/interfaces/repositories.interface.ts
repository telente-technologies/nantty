import type { ActorSummary, DeliveryChannel, DeliveryStatus, InboxCategory, InboxKind, MailKind } from "../types/notification.type.js";

export interface StoredNotification {
  readonly id: string;
  readonly userId: string;
  readonly category: string;
  readonly kind: string | null;
  readonly title: string;
  readonly body: string;
  readonly actor: ActorSummary | null;
  readonly data: Record<string, unknown>;
  readonly readAt: Date | null;
  readonly createdAt: Date;
}

export interface NewNotification {
  readonly userId: string;
  readonly dedupeKey: string;
  readonly category: InboxCategory;
  readonly kind: InboxKind | null;
  readonly templateKey: string | null;
  readonly title: string;
  readonly body: string;
  readonly actor: ActorSummary | null;
  readonly data: Record<string, unknown>;
}

export interface NotificationRepository {
  insertIfAbsent(notification: NewNotification): Promise<StoredNotification | null>;
  findById(id: string): Promise<StoredNotification | null>;
  findByDedupeKey(dedupeKey: string): Promise<StoredNotification | null>;
  list(userId: string, filter: "all" | "mentions", limit: number, cursor: string | null): Promise<{ readonly rows: readonly StoredNotification[]; readonly nextCursor: string | null }>;
  markRead(userId: string, notificationId: string, readAt: Date): Promise<boolean>;
  markAllRead(userId: string, readAt: Date): Promise<number>;
  countUnread(userId: string): Promise<number>;
  deleteForContent(contentId: string): Promise<number>;
}

export interface DeliveryClaim {
  readonly id: string;
  readonly status: DeliveryStatus;
  readonly alreadyProcessed: boolean;
}

export interface DeliveryRepository {
  claim(input: { readonly dedupeKey: string; readonly eventId: string; readonly userId: string | null; readonly channel: DeliveryChannel; readonly templateKey: string | null; readonly mailKind: MailKind | null }): Promise<DeliveryClaim>;
  finish(id: string, status: DeliveryStatus, detail: { readonly skipReason?: string; readonly providerMessageId?: string }): Promise<void>;
  countSentEmails(userId: string, mailKind: MailKind, since: Date): Promise<number>;
  findUserIdByProviderMessageId(providerMessageId: string): Promise<string | null>;
}

export interface PreferenceRow {
  readonly category: string;
  readonly push: boolean;
  readonly email: boolean;
}

export interface PreferenceRepository {
  list(userId: string): Promise<readonly PreferenceRow[]>;
  upsert(userId: string, category: string, changes: { readonly push?: boolean; readonly email?: boolean }): Promise<PreferenceRow>;
}

export interface DeviceTokenRepository {
  register(userId: string, token: string, platform: string): Promise<void>;
  remove(userId: string, token: string): Promise<void>;
  listTokens(userId: string): Promise<readonly string[]>;
}

export type SuppressionReason = "hard_bounce" | "complaint" | "manual";

export interface SuppressionRepository {
  find(email: string): Promise<SuppressionReason | null>;
  upsert(email: string, reason: SuppressionReason, source: string): Promise<void>;
  countByReason(): Promise<Readonly<Record<SuppressionReason, number>>>;
}
