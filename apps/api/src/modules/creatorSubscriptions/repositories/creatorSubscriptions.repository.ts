import { randomUUID } from "node:crypto";

import type {
  CreatorSubscriptionChange,
  CreatorSubscriptionChargeRecord,
  CreatorSubscriptionChargeStatus,
  CreatorSubscriptionRecord,
  CreatorSubscriptionStatus,
  NewCreatorSubscription,
  NewCreatorSubscriptionCharge,
} from "../models/creatorSubscriptions.model.js";

export interface CreatorSubscriptionChargeChange {
  readonly providerTransactionId?: string | null;
  readonly paidAt?: Date;
}

export interface CreatorSubscriptionsRepository {
  create(input: NewCreatorSubscription): Promise<CreatorSubscriptionRecord>;
  findById(subscriptionId: string): Promise<CreatorSubscriptionRecord | undefined>;
  listForSubscriberAndCreators(subscriberId: string, creatorIds: readonly string[]): Promise<readonly CreatorSubscriptionRecord[]>;
  listForSubscriber(subscriberId: string): Promise<readonly CreatorSubscriptionRecord[]>;
  listForCreator(creatorId: string, statuses: readonly CreatorSubscriptionStatus[]): Promise<readonly CreatorSubscriptionRecord[]>;
  listWithPeriodEndingBefore(statuses: readonly CreatorSubscriptionStatus[], before: Date, limit: number): Promise<readonly CreatorSubscriptionRecord[]>;
  update(subscriptionId: string, from: readonly CreatorSubscriptionStatus[], change: CreatorSubscriptionChange): Promise<CreatorSubscriptionRecord | undefined>;
  createCharge(input: NewCreatorSubscriptionCharge): Promise<CreatorSubscriptionChargeRecord>;
  findChargeByReference(reference: string): Promise<CreatorSubscriptionChargeRecord | undefined>;
  changeChargeStatus(chargeId: string, from: CreatorSubscriptionChargeStatus, to: CreatorSubscriptionChargeStatus, change: CreatorSubscriptionChargeChange): Promise<boolean>;
}

export class InMemoryCreatorSubscriptionsRepository implements CreatorSubscriptionsRepository {
  private readonly subscriptions = new Map<string, CreatorSubscriptionRecord>();
  private readonly charges = new Map<string, CreatorSubscriptionChargeRecord>();

  public async create(input: NewCreatorSubscription): Promise<CreatorSubscriptionRecord> {
    const subscription: CreatorSubscriptionRecord = {
      ...input, id: randomUUID(), status: "pending", authorizationEncrypted: null, payerEmail: null, currentPeriodStart: null, currentPeriodEnd: null,
    };
    this.subscriptions.set(subscription.id, subscription);
    return subscription;
  }

  public async findById(subscriptionId: string): Promise<CreatorSubscriptionRecord | undefined> {
    return this.subscriptions.get(subscriptionId);
  }

  public async listForSubscriberAndCreators(subscriberId: string, creatorIds: readonly string[]): Promise<readonly CreatorSubscriptionRecord[]> {
    return [...this.subscriptions.values()].filter((item) => item.subscriberId === subscriberId && creatorIds.includes(item.creatorId));
  }

  public async listForSubscriber(subscriberId: string): Promise<readonly CreatorSubscriptionRecord[]> {
    return [...this.subscriptions.values()].filter((item) => item.subscriberId === subscriberId).sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }

  public async listForCreator(creatorId: string, statuses: readonly CreatorSubscriptionStatus[]): Promise<readonly CreatorSubscriptionRecord[]> {
    return [...this.subscriptions.values()].filter((item) => item.creatorId === creatorId && statuses.includes(item.status));
  }

  public async listWithPeriodEndingBefore(statuses: readonly CreatorSubscriptionStatus[], before: Date, limit: number): Promise<readonly CreatorSubscriptionRecord[]> {
    return [...this.subscriptions.values()]
      .filter((item) => statuses.includes(item.status) && item.currentPeriodEnd !== null && item.currentPeriodEnd <= before)
      .slice(0, limit);
  }

  public async update(subscriptionId: string, from: readonly CreatorSubscriptionStatus[], change: CreatorSubscriptionChange): Promise<CreatorSubscriptionRecord | undefined> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription === undefined || !from.includes(subscription.status)) return undefined;
    const updated = { ...subscription, ...change };
    this.subscriptions.set(subscriptionId, updated);
    return updated;
  }

  public async createCharge(input: NewCreatorSubscriptionCharge): Promise<CreatorSubscriptionChargeRecord> {
    const charge: CreatorSubscriptionChargeRecord = { ...input, id: randomUUID(), status: "pending", providerTransactionId: null, paidAt: null };
    this.charges.set(charge.id, charge);
    return charge;
  }

  public async findChargeByReference(reference: string): Promise<CreatorSubscriptionChargeRecord | undefined> {
    return [...this.charges.values()].find((charge) => charge.reference === reference);
  }

  public async changeChargeStatus(chargeId: string, from: CreatorSubscriptionChargeStatus, to: CreatorSubscriptionChargeStatus, change: CreatorSubscriptionChargeChange): Promise<boolean> {
    const charge = this.charges.get(chargeId);
    if (charge?.status !== from) return false;
    this.charges.set(chargeId, { ...charge, ...change, status: to });
    return true;
  }
}
