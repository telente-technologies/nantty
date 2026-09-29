import { randomUUID } from "node:crypto";

import type {
  AdBillingTransactionRecord,
  AdEventFilter,
  AdEventRecord,
  AdEventType,
  AdServingRecord,
  NewAdBillingTransactionInput,
  NewAdEventInput,
  NewAdServingInput,
} from "../models/adDelivery.model.js";

export interface ServingLookup {
  readonly viewerId: string;
  readonly campaignId: string;
  readonly itemId: string;
  readonly servedAfter: Date;
}

export interface AdDeliveryRepository {
  createServings(servings: readonly NewAdServingInput[]): Promise<readonly AdServingRecord[]>;
  findLatestServing(lookup: ServingLookup): Promise<AdServingRecord | undefined>;
  recordEvent(event: NewAdEventInput): Promise<AdEventRecord | undefined>;
  updateEventBilling(eventId: string, billed: boolean, chargeMilliMinor: number, rejectionReason: string | null): Promise<void>;
  countViewerEvents(viewerId: string, type: AdEventType, since: Date): Promise<number>;
  countViewerImpressionsByCampaign(viewerId: string, since: Date): Promise<ReadonlyMap<string, number>>;
  listViewerClicks(viewerId: string, since: Date): Promise<readonly AdEventRecord[]>;
  listEvents(filter: AdEventFilter): Promise<readonly AdEventRecord[]>;
  recordBillingTransaction(transaction: NewAdBillingTransactionInput): Promise<AdBillingTransactionRecord | undefined>;
  listBillingTransactions(accountId: string): Promise<readonly AdBillingTransactionRecord[]>;
}

export function eventMatchesFilter(event: AdEventRecord, filter: AdEventFilter): boolean {
  return (
    event.accountId === filter.accountId &&
    (filter.campaignIds === undefined || filter.campaignIds.includes(event.campaignId)) &&
    (filter.adSetId === undefined || event.adSetId === filter.adSetId) &&
    (filter.adId === undefined || event.adId === filter.adId) &&
    (filter.from === undefined || event.occurredAt >= filter.from) &&
    (filter.to === undefined || event.occurredAt < filter.to)
  );
}

export class InMemoryAdDeliveryRepository implements AdDeliveryRepository {
  private readonly servings: AdServingRecord[] = [];
  private readonly events = new Map<string, AdEventRecord>();
  private readonly transactions = new Map<string, AdBillingTransactionRecord>();

  public async createServings(servings: readonly NewAdServingInput[]): Promise<readonly AdServingRecord[]> {
    const created = servings.map((serving) => ({ ...serving, id: randomUUID() }));
    this.servings.push(...created);
    return created;
  }

  public async findLatestServing(lookup: ServingLookup): Promise<AdServingRecord | undefined> {
    return this.servings
      .filter((serving) => serving.viewerId === lookup.viewerId && serving.campaignId === lookup.campaignId && serving.itemId === lookup.itemId && serving.servedAt >= lookup.servedAfter)
      .sort((left, right) => right.servedAt.getTime() - left.servedAt.getTime())[0];
  }

  public async recordEvent(event: NewAdEventInput): Promise<AdEventRecord | undefined> {
    if (this.events.has(event.dedupeKey)) return undefined;
    const created = { ...event, id: randomUUID() };
    this.events.set(event.dedupeKey, created);
    return created;
  }

  public async updateEventBilling(eventId: string, billed: boolean, chargeMilliMinor: number, rejectionReason: string | null): Promise<void> {
    for (const [key, event] of this.events) {
      if (event.id === eventId) this.events.set(key, { ...event, billed, chargeMilliMinor, rejectionReason });
    }
  }

  public async countViewerEvents(viewerId: string, type: AdEventType, since: Date): Promise<number> {
    return [...this.events.values()].filter((event) => event.viewerId === viewerId && event.type === type && event.occurredAt >= since).length;
  }

  public async countViewerImpressionsByCampaign(viewerId: string, since: Date): Promise<ReadonlyMap<string, number>> {
    const counts = new Map<string, number>();
    for (const event of this.events.values()) {
      if (event.viewerId === viewerId && event.type === "impression" && event.occurredAt >= since) counts.set(event.campaignId, (counts.get(event.campaignId) ?? 0) + 1);
    }
    return counts;
  }

  public async listViewerClicks(viewerId: string, since: Date): Promise<readonly AdEventRecord[]> {
    return [...this.events.values()]
      .filter((event) => event.viewerId === viewerId && event.type === "click" && event.rejectionReason === null && event.occurredAt >= since)
      .sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime());
  }

  public async listEvents(filter: AdEventFilter): Promise<readonly AdEventRecord[]> {
    return [...this.events.values()].filter((event) => eventMatchesFilter(event, filter));
  }

  public async recordBillingTransaction(transaction: NewAdBillingTransactionInput): Promise<AdBillingTransactionRecord | undefined> {
    if (this.transactions.has(transaction.reference)) return undefined;
    const created = { ...transaction, id: randomUUID() };
    this.transactions.set(transaction.reference, created);
    return created;
  }

  public async listBillingTransactions(accountId: string): Promise<readonly AdBillingTransactionRecord[]> {
    return [...this.transactions.values()]
      .filter((transaction) => transaction.accountId === accountId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime() || right.id.localeCompare(left.id));
  }
}
