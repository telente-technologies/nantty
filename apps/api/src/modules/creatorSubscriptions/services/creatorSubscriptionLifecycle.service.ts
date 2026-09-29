import { randomUUID } from "node:crypto";

import { invalidState, notFound } from "../../../errors/domain.error.js";
import type { CreatorSubscriberLookup } from "../../../interfaces/creatorSubscriberLookup.interface.js";
import type { AppLogger } from "../../../loggers/app.logger.js";
import { CREATOR_SUBSCRIPTION_REFERENCE_PREFIX, hasSubscriberAccess, type CreatorSubscriptionRecord } from "../models/creatorSubscriptions.model.js";
import type { CreatorSubscriptionsRepository } from "../repositories/creatorSubscriptions.repository.js";
import type { CreatorSubscriptionBillingService } from "./creatorSubscriptionBilling.service.js";

const RENEWAL_BATCH_SIZE = 100;
const DAY_MILLISECONDS = 86_400_000;

export class RepositoryCreatorSubscriberLookup implements CreatorSubscriberLookup {
  public constructor(private readonly subscriptions: CreatorSubscriptionsRepository, private readonly now: () => Date) {}

  public async listCreatorIdsViewerSubscribesTo(viewerId: string, creatorIds: readonly string[]): Promise<ReadonlySet<string>> {
    if (creatorIds.length === 0) return new Set();
    const now = this.now();
    const subscriptions = await this.subscriptions.listForSubscriberAndCreators(viewerId, creatorIds);
    return new Set(subscriptions.filter((subscription) => hasSubscriberAccess(subscription, now)).map((subscription) => subscription.creatorId));
  }
}

export class CreatorSubscriptionLifecycleService {
  public constructor(private readonly billing: CreatorSubscriptionBillingService, private readonly logger: AppLogger) {}

  public async findSubscriptionForMember(userId: string, subscriptionId: string): Promise<CreatorSubscriptionRecord> {
    const subscription = await this.billing.dependencies.subscriptions.findById(subscriptionId);
    if (subscription === undefined || (subscription.subscriberId !== userId && subscription.creatorId !== userId)) throw notFound("Subscription");
    return subscription;
  }

  public listMySubscriptions(subscriberId: string): Promise<readonly CreatorSubscriptionRecord[]> {
    return this.billing.dependencies.subscriptions.listForSubscriber(subscriberId);
  }

  public async listSubscribersOfCreator(creatorId: string): Promise<readonly CreatorSubscriptionRecord[]> {
    const now = this.billing.dependencies.clock.now();
    const subscriptions = await this.billing.dependencies.subscriptions.listForCreator(creatorId, ["active", "past_due", "cancelled"]);
    return subscriptions.filter((subscription) => hasSubscriberAccess(subscription, now));
  }

  public async cancelSubscription(subscriberId: string, subscriptionId: string): Promise<CreatorSubscriptionRecord> {
    const subscription = await this.findSubscriptionForMember(subscriberId, subscriptionId);
    if (subscription.subscriberId !== subscriberId) throw notFound("Subscription");
    const cancelled = await this.billing.dependencies.subscriptions.update(subscription.id, ["active", "past_due"], { status: "cancelled" });
    if (cancelled === undefined) throw invalidState("Only an active subscription can be cancelled.");
    await this.billing.dependencies.audit.record({ actorId: subscriberId, action: "creator_subscriptions.cancelled", entityType: "creator_subscription", entityId: subscription.id });
    return cancelled;
  }

  public async resumeSubscription(subscriberId: string, subscriptionId: string): Promise<CreatorSubscriptionRecord> {
    const subscription = await this.findSubscriptionForMember(subscriberId, subscriptionId);
    if (subscription.subscriberId !== subscriberId || !hasSubscriberAccess(subscription, this.billing.dependencies.clock.now())) throw invalidState("This subscription has ended; subscribe again.");
    const resumed = await this.billing.dependencies.subscriptions.update(subscription.id, ["cancelled"], { status: "active" });
    if (resumed === undefined) throw invalidState("Only a cancelled subscription can be resumed.");
    await this.billing.dependencies.audit.record({ actorId: subscriberId, action: "creator_subscriptions.resumed", entityType: "creator_subscription", entityId: subscription.id });
    return resumed;
  }

  public async processDueSubscriptions(): Promise<number> {
    const { subscriptions, clock, gracePeriodDays } = this.billing.dependencies;
    const now = clock.now();
    for (const ended of await subscriptions.listWithPeriodEndingBefore(["cancelled"], now, RENEWAL_BATCH_SIZE)) {
      await subscriptions.update(ended.id, ["cancelled"], { status: "expired" });
    }
    const graceCutoff = new Date(now.getTime() - gracePeriodDays * DAY_MILLISECONDS);
    for (const lapsed of await subscriptions.listWithPeriodEndingBefore(["past_due"], graceCutoff, RENEWAL_BATCH_SIZE)) {
      await subscriptions.update(lapsed.id, ["past_due"], { status: "expired" });
    }
    let renewed = 0;
    for (const due of await subscriptions.listWithPeriodEndingBefore(["active"], now, RENEWAL_BATCH_SIZE)) {
      try {
        if (await this.renewWithSavedAuthorization(due)) renewed += 1;
      } catch (error) {
        this.logger.error("Creator subscription renewal failed", { subscriptionId: due.id, error: String(error) });
      }
    }
    return renewed;
  }

  private async renewWithSavedAuthorization(subscription: CreatorSubscriptionRecord): Promise<boolean> {
    const { subscriptions, cipher, clock } = this.billing.dependencies;
    const claimed = await subscriptions.update(subscription.id, ["active"], { status: "past_due" });
    if (claimed === undefined || subscription.authorizationEncrypted === null || subscription.payerEmail === null) return false;
    const reference = `${CREATOR_SUBSCRIPTION_REFERENCE_PREFIX}renew_${randomUUID().replaceAll("-", "")}`;
    const charge = await subscriptions.createCharge({
      subscriptionId: subscription.id, subscriberId: subscription.subscriberId, creatorId: subscription.creatorId, kind: "renewal", reference,
      provider: subscription.provider, amount: subscription.amount, currency: subscription.currency, createdAt: clock.now(),
    });
    const result = await this.billing.findGatewayOrThrow(subscription.provider).chargeSavedAuthorization({
      reference, authorization: await cipher.decryptText(subscription.authorizationEncrypted), email: subscription.payerEmail, amount: subscription.amount, currency: subscription.currency,
    });
    this.logger.info("Creator subscription renewal charged", { subscriptionId: subscription.id, status: result.status });
    await this.billing.confirmChargeWithProvider(charge);
    return result.status === "succeeded";
  }
}
