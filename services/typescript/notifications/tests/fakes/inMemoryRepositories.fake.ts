import type { CampaignRepository, NoticeDraftRepository } from "../../src/interfaces/campaignRepository.interface.js";
import type {
  DeliveryClaim, DeliveryRepository, DeviceTokenRepository, NewNotification, NotificationRepository, PreferenceRepository, PreferenceRow, StoredNotification, SuppressionReason, SuppressionRepository,
} from "../../src/interfaces/repositories.interface.js";
import type { BatchProgress, Campaign, CampaignKind, NewCampaign, NoticeDraft } from "../../src/types/campaign.type.js";
import type { DeliveryStatus, MailKind } from "../../src/types/notification.type.js";

export class InMemoryNotificationRepository implements NotificationRepository {
  public readonly rows: StoredNotification[] = [];
  private readonly keys = new Map<string, StoredNotification>();
  private sequence = 0;

  public async insertIfAbsent(notification: NewNotification): Promise<StoredNotification | null> {
    if (this.keys.has(notification.dedupeKey)) return null;
    this.sequence += 1;
    const stored: StoredNotification = { id: `n${this.sequence}`, userId: notification.userId, category: notification.category, kind: notification.kind, title: notification.title, body: notification.body, actor: notification.actor, data: notification.data, readAt: null, createdAt: new Date(Date.UTC(2026, 9, 3, 0, 0, this.sequence)) };
    this.keys.set(notification.dedupeKey, stored);
    this.rows.push(stored);
    return stored;
  }

  public async findById(id: string) { return this.rows.find((row) => row.id === id) ?? null; }
  public async findByDedupeKey(dedupeKey: string) { return this.keys.get(dedupeKey) ?? null; }

  public async list(userId: string, filter: "all" | "mentions", limit: number, cursor: string | null) {
    const mine = this.rows.filter((row) => row.userId === userId && (filter === "all" || row.kind === "mention")).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const start = cursor === null ? 0 : mine.findIndex((row) => row.id === cursor) + 1;
    const rows = mine.slice(start, start + limit);
    return { rows, nextCursor: start + limit < mine.length ? (rows[rows.length - 1]?.id ?? null) : null };
  }

  public async markRead(userId: string, notificationId: string, readAt: Date) {
    const index = this.rows.findIndex((row) => row.id === notificationId && row.userId === userId);
    const row = this.rows[index];
    if (row === undefined) return false;
    this.replace(index, { ...row, readAt: row.readAt ?? readAt });
    return true;
  }

  public async markAllRead(userId: string, readAt: Date) {
    let count = 0;
    this.rows.forEach((row, index) => {
      if (row.userId === userId && row.readAt === null) { this.replace(index, { ...row, readAt }); count += 1; }
    });
    return count;
  }

  public async countUnread(userId: string) { return this.rows.filter((row) => row.userId === userId && row.readAt === null).length; }

  public async deleteForContent(contentId: string) {
    const keep = this.rows.filter((row) => !["postId", "originalPostId", "replyClipId", "originalClipId"].some((key) => row.data[key] === contentId));
    const removed = this.rows.length - keep.length;
    this.rows.splice(0, this.rows.length, ...keep);
    return removed;
  }

  private replace(index: number, next: StoredNotification) {
    const previous = this.rows[index];
    this.rows[index] = next;
    for (const [key, value] of this.keys) if (value === previous) this.keys.set(key, next);
  }
}

export interface RecordedDelivery {
  id: string; dedupeKey: string; eventId: string; userId: string | null; channel: string; templateKey: string | null; mailKind: MailKind | null;
  status: DeliveryStatus; skipReason?: string; providerMessageId?: string; createdAt: Date;
}

export class InMemoryDeliveryRepository implements DeliveryRepository {
  public readonly rows = new Map<string, RecordedDelivery>();
  public now = () => new Date();

  public async claim(input: Parameters<DeliveryRepository["claim"]>[0]): Promise<DeliveryClaim> {
    const existing = this.rows.get(input.dedupeKey);
    if (existing !== undefined) {
      const retryable = existing.status === "pending" || existing.status === "failed";
      if (retryable) existing.status = "pending";
      return { id: existing.id, status: existing.status, alreadyProcessed: !retryable };
    }
    const row: RecordedDelivery = { id: `d${this.rows.size + 1}`, ...input, status: "pending", createdAt: this.now() };
    this.rows.set(input.dedupeKey, row);
    return { id: row.id, status: "pending", alreadyProcessed: false };
  }

  public async finish(id: string, status: DeliveryStatus, detail: { skipReason?: string; providerMessageId?: string }) {
    const row = [...this.rows.values()].find((candidate) => candidate.id === id);
    if (row !== undefined) Object.assign(row, { status, ...detail });
  }

  public async countSentEmails(userId: string, mailKind: MailKind, since: Date) {
    return [...this.rows.values()].filter((row) => row.userId === userId && row.channel === "email" && row.mailKind === mailKind && row.status === "sent" && row.createdAt >= since).length;
  }

  public async findUserIdByProviderMessageId(providerMessageId: string) { return [...this.rows.values()].find((row) => row.providerMessageId === providerMessageId)?.userId ?? null; }
  public byChannel(channel: string) { return [...this.rows.values()].filter((row) => row.channel === channel); }
}

export class InMemoryPreferenceRepository implements PreferenceRepository {
  public readonly rows = new Map<string, PreferenceRow & { userId: string }>();
  public async list(userId: string) { return [...this.rows.values()].filter((row) => row.userId === userId); }
  public async upsert(userId: string, category: string, changes: { push?: boolean; email?: boolean }) {
    const previous = this.rows.get(`${userId}:${category}`);
    const next = { userId, category, push: changes.push ?? previous?.push ?? true, email: changes.email ?? previous?.email ?? true };
    this.rows.set(`${userId}:${category}`, next);
    return next;
  }
}

export class InMemoryDeviceTokenRepository implements DeviceTokenRepository {
  public readonly tokens = new Map<string, string>();
  public async register(userId: string, token: string, _platform: string) { this.tokens.set(token, userId); }
  public async remove(userId: string, token: string) { if (this.tokens.get(token) === userId) this.tokens.delete(token); }
  public async listTokens(userId: string) { return [...this.tokens].filter(([, owner]) => owner === userId).map(([token]) => token); }
}

export class InMemorySuppressionRepository implements SuppressionRepository {
  public readonly rows = new Map<string, SuppressionReason>();
  public async find(email: string) { return this.rows.get(email.toLowerCase()) ?? null; }
  public async upsert(email: string, reason: SuppressionReason) {
    if (this.rows.get(email.toLowerCase()) === "hard_bounce") return;
    this.rows.set(email.toLowerCase(), reason);
  }
  public async countByReason() {
    const counts: Record<SuppressionReason, number> = { hard_bounce: 0, complaint: 0, manual: 0 };
    for (const reason of this.rows.values()) counts[reason] += 1;
    return counts;
  }
}

export class InMemoryCampaignRepository implements CampaignRepository {
  public readonly rows: Campaign[] = [];
  public async create(campaign: NewCampaign) {
    const row: Campaign = { ...campaign, id: `c${this.rows.length + 1}`, status: "QUEUED", sentCount: 0, failedCount: 0, batchesDone: 0, nextCursor: null, createdAt: new Date(), completedAt: null };
    this.rows.push(row);
    return row;
  }
  public async findById(id: string) { return this.rows.find((row) => row.id === id) ?? null; }
  public async list(kind: CampaignKind) { return this.rows.filter((row) => row.kind === kind); }
  public async findActiveForVersion(versionId: string) { return this.rows.find((row) => row.versionId === versionId && row.status !== "COMPLETED") ?? null; }
  public async applyBatchProgress(id: string, expectedBatchesDone: number, progress: BatchProgress, completedAt: Date | null) {
    const index = this.rows.findIndex((row) => row.id === id && row.batchesDone === expectedBatchesDone);
    const row = this.rows[index];
    if (row === undefined) return false;
    this.rows[index] = { ...row, sentCount: row.sentCount + progress.sentCount, failedCount: row.failedCount + progress.failedCount, batchesDone: row.batchesDone + 1, nextCursor: progress.nextCursor, status: completedAt === null ? "SENDING" : "COMPLETED", completedAt };
    return true;
  }
}

export class InMemoryNoticeDraftRepository implements NoticeDraftRepository {
  public readonly rows = new Map<string, NoticeDraft>();
  public async find(versionId: string) { return this.rows.get(versionId) ?? null; }
  public async createIfAbsent(draft: Parameters<NoticeDraftRepository["createIfAbsent"]>[0]) {
    const existing = this.rows.get(draft.versionId);
    if (existing !== undefined) return existing;
    const created: NoticeDraft = { ...draft, updatedByName: null, updatedAt: new Date(), testSends: [] };
    this.rows.set(draft.versionId, created);
    return created;
  }
  public async update(versionId: string, changes: Parameters<NoticeDraftRepository["update"]>[1]) {
    const existing = this.rows.get(versionId);
    if (existing === undefined) return null;
    const next = { ...existing, ...changes, updatedAt: new Date() };
    this.rows.set(versionId, next);
    return next;
  }
  public async refreshVersionFacts(versionId: string, facts: Parameters<NoticeDraftRepository["refreshVersionFacts"]>[1]) {
    const existing = this.rows.get(versionId);
    if (existing === undefined) return null;
    const next = { ...existing, ...facts };
    this.rows.set(versionId, next);
    return next;
  }
  public async appendTestSend(versionId: string, testSend: { sentToEmail: string; sentByName: string; sentAt: string }) {
    const existing = this.rows.get(versionId);
    if (existing === undefined) return null;
    const next = { ...existing, testSends: [testSend, ...existing.testSends] };
    this.rows.set(versionId, next);
    return next;
  }
}
