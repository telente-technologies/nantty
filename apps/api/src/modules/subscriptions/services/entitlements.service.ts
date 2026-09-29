import type { Clock } from "../../../interfaces/clock.interface.js";
import type { EntitlementsLookup, EntitlementSet, ProfileEntitlements } from "../../../interfaces/entitlements.interface.js";
import type { VerificationColor, VerificationTier } from "../../../interfaces/verificationBadge.interface.js";
import type { SubscriptionRecord } from "../models/subscriptions.model.js";
import { addDays } from "../policies/subscription.policy.js";
import type { SubscriptionPlansRepository } from "../repositories/subscriptionPlans.repository.js";
import type { SubscriptionsRepository } from "../repositories/subscriptions.repository.js";
import { findColorForProfileType } from "../../verifications/policies/verification.policy.js";

export function subscriptionGrantsEntitlements(subscription: SubscriptionRecord, now: Date, gracePeriodDays: number): boolean {
  if (subscription.status === "ACTIVE" || subscription.status === "TRIALING") return true;
  if (subscription.status === "CANCELLED") return subscription.endsAt !== null && subscription.endsAt > now;
  if (subscription.status === "PAST_DUE") return subscription.pastDueSince !== null && addDays(subscription.pastDueSince, gracePeriodDays) > now;
  return false;
}

export class SubscriptionEntitlements implements EntitlementsLookup {
  public constructor(
    private readonly subscriptions: SubscriptionsRepository,
    private readonly plans: SubscriptionPlansRepository,
    private readonly clock: Clock,
    private readonly gracePeriodDays: number,
  ) {}

  public findEntitlementsForUser(userId: string): Promise<ProfileEntitlements> {
    return this.findEntitlementsForProfile(userId, "BLUE");
  }

  public findEntitlementsForStore(storeId: string): Promise<ProfileEntitlements> {
    return this.findEntitlementsForProfile(storeId, "GOLD");
  }

  public async findEntitledTier(profileId: string): Promise<VerificationTier | null> {
    const subscription = await this.subscriptions.findByProfileId(profileId);
    return subscription !== undefined && subscriptionGrantsEntitlements(subscription, this.clock.now(), this.gracePeriodDays) ? subscription.plan : null;
  }

  private async findEntitlementsForProfile(profileId: string, defaultColor: VerificationColor): Promise<ProfileEntitlements> {
    const subscription = await this.subscriptions.findByProfileId(profileId);
    if (subscription === undefined) return { profileId, color: defaultColor, tier: null, subscriptionStatus: null, entitlements: {} };
    const color = findColorForProfileType(subscription.profileType);
    const granted = subscriptionGrantsEntitlements(subscription, this.clock.now(), this.gracePeriodDays);
    const plan = granted ? await this.plans.findPlanByColorAndTier(color, subscription.plan) : undefined;
    const entitlements: EntitlementSet = Object.fromEntries((plan?.entitlements ?? []).map((entitlement) => [entitlement.key, entitlement.value]));
    return { profileId, color, tier: granted ? subscription.plan : null, subscriptionStatus: subscription.status, entitlements };
  }
}
