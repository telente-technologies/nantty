import { randomUUID } from "node:crypto";

import type { AppLogger } from "../../../loggers/app.logger.js";
import { SUBSCRIPTION_REFERENCE_PREFIX, type SubscriptionRecord } from "../models/subscriptions.model.js";
import { addDays } from "../policies/subscription.policy.js";
import type { SubscriptionBillingService } from "./subscriptionBilling.service.js";
import { choosePlanPrice } from "./subscriptionPlans.service.js";
import { findColorForProfileType } from "../../verifications/policies/verification.policy.js";

const RENEWAL_BATCH_SIZE = 100;
const RETRY_AFTER_DAYS = 1;

export class SubscriptionRenewalsService {
  public constructor(private readonly billing: SubscriptionBillingService, private readonly gracePeriodDays: number, private readonly logger: AppLogger) {}

  public async processDueSubscriptions(): Promise<number> {
    const { lifecycle } = this.billing.dependencies;
    const now = lifecycle.clock.now();
    let processed = 0;
    for (const subscription of await lifecycle.subscriptions.listDueForBilling(now, RENEWAL_BATCH_SIZE)) {
      try {
        await this.processSubscription(subscription, now);
        processed += 1;
      } catch (error) {
        this.logger.error("A subscription renewal failed", { profileId: subscription.profileId, error: String(error) });
      }
    }
    return processed;
  }

  private async processSubscription(subscription: SubscriptionRecord, now: Date): Promise<void> {
    const { lifecycle } = this.billing.dependencies;
    if (subscription.status === "CANCELLED") {
      await lifecycle.expire(subscription.profileId, null);
      return;
    }
    if (subscription.status === "PAST_DUE") {
      if (subscription.pastDueSince === null || addDays(subscription.pastDueSince, this.gracePeriodDays) <= now) {
        await lifecycle.expire(subscription.profileId, null);
        return;
      }
      const lastAttempt = subscription.lastChargeAttemptAt;
      if (subscription.authorizationEncrypted !== null && (lastAttempt === null || addDays(lastAttempt, RETRY_AFTER_DAYS) <= now)) await this.chargeRenewal(subscription);
      return;
    }
    if (!subscription.autoRenew) {
      await lifecycle.expire(subscription.profileId, null);
      return;
    }
    if (subscription.authorizationEncrypted === null) {
      await lifecycle.markPastDue(subscription.profileId, null);
      return;
    }
    await this.chargeRenewal(subscription);
  }

  private async chargeRenewal(subscription: SubscriptionRecord): Promise<void> {
    const { lifecycle, charges, plans, cipher } = this.billing.dependencies;
    if (subscription.provider === null || subscription.currency === null || subscription.authorizationEncrypted === null || subscription.payerEmail === null) {
      if (subscription.status !== "PAST_DUE") await lifecycle.markPastDue(subscription.profileId, null);
      return;
    }
    const plan = (await plans.listAllPlans()).find((candidate) => candidate.color === findColorForProfileType(subscription.profileType) && candidate.tier === subscription.plan);
    const price = plan === undefined ? undefined : choosePlanPrice(plan, subscription.interval, subscription.currency);
    const amount = price?.currency === subscription.currency ? price.amount : (subscription.amount ?? 0);
    const reference = `${SUBSCRIPTION_REFERENCE_PREFIX}${randomUUID().replaceAll("-", "")}`;
    await lifecycle.subscriptions.update(subscription.profileId, { lastChargeAttemptAt: lifecycle.clock.now() }, lifecycle.clock.now());
    const charge = await charges.create({
      profileId: subscription.profileId, profileKind: subscription.profileKind, profileType: subscription.profileType, ownerUserId: subscription.ownerUserId,
      payerUserId: subscription.ownerUserId, plan: subscription.plan, interval: subscription.interval, kind: "renewal", reference,
      provider: subscription.provider, amount, currency: subscription.currency,
    });
    const result = await this.billing.findGatewayOrThrow(subscription.provider).chargeSavedAuthorization({
      reference, amount, currency: subscription.currency, email: subscription.payerEmail, authorization: await cipher.decryptText(subscription.authorizationEncrypted),
    });
    if (result.status === "failed") {
      await charges.changeStatus(charge.id, "pending", "failed", { providerTransactionId: result.providerTransactionId });
      if (subscription.status !== "PAST_DUE") await lifecycle.markPastDue(subscription.profileId, null);
      return;
    }
    await this.billing.confirmChargeWithProvider(charge);
  }
}
