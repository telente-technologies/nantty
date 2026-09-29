import type { CurrencyCode } from "../../../enums/currency.enum.js";
import { Money } from "../../../utils/money.util.js";
import type { PlanRecord, SubscriptionRecord } from "../models/subscriptions.model.js";
import type { SubscriptionCheckout } from "../services/subscriptionBilling.service.js";
import { choosePlanPrice } from "../services/subscriptionPlans.service.js";

function convertDateToText(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}

export function convertPlanToDto(plan: PlanRecord, preferredCurrency: CurrencyCode) {
  const priceFor = (interval: "MONTHLY" | "YEARLY") => {
    const price = choosePlanPrice(plan, interval, preferredCurrency);
    return price === undefined ? null : Money.of(price.amount, price.currency).toDto();
  };
  return {
    id: plan.id,
    color: plan.color,
    tier: plan.tier,
    name: plan.name,
    description: plan.description,
    trialDays: plan.trialDays,
    prices: { monthly: priceFor("MONTHLY"), yearly: priceFor("YEARLY") },
    perks: plan.perks,
    entitlements: Object.fromEntries(plan.entitlements.map((entitlement) => [entitlement.key, entitlement.value])),
  };
}

export function convertPlanToAdminDto(plan: PlanRecord) {
  return {
    ...plan,
    prices: plan.prices.map((price) => ({ interval: price.interval, price: Money.of(price.amount, price.currency).toDto() })),
  };
}

export function convertSubscriptionToDto(subscription: SubscriptionRecord) {
  return {
    profileId: subscription.profileId,
    profileType: subscription.profileType,
    plan: subscription.plan,
    status: subscription.status,
    autoRenew: subscription.autoRenew,
    interval: subscription.interval,
    price: subscription.amount === null || subscription.currency === null ? null : Money.of(subscription.amount, subscription.currency).toDto(),
    startsAt: subscription.startsAt.toISOString(),
    endsAt: convertDateToText(subscription.endsAt),
    currentPeriodEnd: convertDateToText(subscription.endsAt),
    trialEndsAt: convertDateToText(subscription.trialEndsAt),
    cancelledAt: convertDateToText(subscription.cancelledAt),
    pastDueSince: convertDateToText(subscription.pastDueSince),
  };
}

export function convertCheckoutToResponse(checkout: SubscriptionCheckout) {
  return {
    authorizationUrl: checkout.authorizationUrl,
    reference: checkout.reference,
    callbackUrl: checkout.callbackUrl,
    amount: checkout.charge === null ? null : Money.of(checkout.charge.amount, checkout.charge.currency).toDto(),
    subscription: checkout.subscription === null ? null : convertSubscriptionToDto(checkout.subscription),
  };
}
