import { randomUUID } from "node:crypto";

import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { compareByNewestFirst, paginateSortedItems } from "../../../utils/pagination.util.js";
import type {
  ChargeStatus,
  NewSubscription,
  NewSubscriptionCharge,
  SubscriptionChargeRecord,
  SubscriptionFilter,
  SubscriptionPatch,
  SubscriptionRecord,
} from "../models/subscriptions.model.js";

export interface ChargeStatusChange {
  readonly providerTransactionId?: string | null;
  readonly paidAt?: Date;
}

export interface SubscriptionsRepository {
  findByProfileId(profileId: string): Promise<SubscriptionRecord | undefined>;
  create(input: NewSubscription): Promise<SubscriptionRecord>;
  update(profileId: string, patch: SubscriptionPatch, updatedAt: Date): Promise<SubscriptionRecord>;
  list(filter: SubscriptionFilter, page: PageRequest): Promise<Page<SubscriptionRecord>>;
  listDueForBilling(now: Date, limit: number): Promise<readonly SubscriptionRecord[]>;
}

export interface SubscriptionChargesRepository {
  create(input: NewSubscriptionCharge): Promise<SubscriptionChargeRecord>;
  findByReference(reference: string): Promise<SubscriptionChargeRecord | undefined>;
  changeStatus(chargeId: string, from: ChargeStatus, to: ChargeStatus, change: ChargeStatusChange): Promise<boolean>;
}

export function isDueForBilling(subscription: SubscriptionRecord, now: Date): boolean {
  if (subscription.status === "PAST_DUE") return true;
  const billable = subscription.status === "ACTIVE" || subscription.status === "TRIALING" || subscription.status === "CANCELLED";
  return billable && subscription.endsAt !== null && subscription.endsAt <= now;
}

export class InMemorySubscriptionsRepository implements SubscriptionsRepository {
  private readonly subscriptions = new Map<string, SubscriptionRecord>();

  public async findByProfileId(profileId: string): Promise<SubscriptionRecord | undefined> {
    return this.subscriptions.get(profileId);
  }

  public async create(input: NewSubscription): Promise<SubscriptionRecord> {
    const now = new Date();
    const record: SubscriptionRecord = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
    this.subscriptions.set(record.profileId, record);
    return record;
  }

  public async update(profileId: string, patch: SubscriptionPatch, updatedAt: Date): Promise<SubscriptionRecord> {
    const existing = this.subscriptions.get(profileId);
    if (existing === undefined) throw new Error(`No subscription for profile ${profileId}.`);
    const updated: SubscriptionRecord = { ...existing, ...patch, updatedAt };
    this.subscriptions.set(profileId, updated);
    return updated;
  }

  public async list(filter: SubscriptionFilter, page: PageRequest): Promise<Page<SubscriptionRecord>> {
    const matches = [...this.subscriptions.values()]
      .filter((record) => (filter.status === undefined || record.status === filter.status) && (filter.plan === undefined || record.plan === filter.plan))
      .sort(compareByNewestFirst);
    return paginateSortedItems(matches, page);
  }

  public async listDueForBilling(now: Date, limit: number): Promise<readonly SubscriptionRecord[]> {
    return [...this.subscriptions.values()].filter((subscription) => isDueForBilling(subscription, now)).slice(0, limit);
  }
}

export class InMemorySubscriptionChargesRepository implements SubscriptionChargesRepository {
  private readonly charges = new Map<string, SubscriptionChargeRecord>();

  public async create(input: NewSubscriptionCharge): Promise<SubscriptionChargeRecord> {
    const charge: SubscriptionChargeRecord = { ...input, id: randomUUID(), status: "pending", providerTransactionId: null, paidAt: null, createdAt: new Date() };
    this.charges.set(charge.id, charge);
    return charge;
  }

  public async findByReference(reference: string): Promise<SubscriptionChargeRecord | undefined> {
    return [...this.charges.values()].find((charge) => charge.reference === reference);
  }

  public async changeStatus(chargeId: string, from: ChargeStatus, to: ChargeStatus, change: ChargeStatusChange): Promise<boolean> {
    const charge = this.charges.get(chargeId);
    if (charge?.status !== from) return false;
    this.charges.set(chargeId, { ...charge, ...change, status: to });
    return true;
  }
}
