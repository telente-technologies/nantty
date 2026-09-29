import type { UserSummary } from "../../../interfaces/userDirectory.interface.js";
import { Money, type MoneyDto } from "../../../utils/money.util.js";
import type { CreatorPlanRecord, CreatorSubscriptionRecord, PlanBenefit } from "../models/creatorSubscriptions.model.js";

export interface CreatorPlanDto {
  readonly id: string;
  readonly creatorId: string;
  readonly name: string;
  readonly description: string;
  readonly price: MoneyDto;
  readonly interval: string;
  readonly benefits: readonly string[];
  readonly benefitDetails: readonly PlanBenefit[];
  readonly subscriberCount: number;
  readonly active: boolean;
}

export interface CreatorSubscriptionStateDto {
  readonly subscriptionId: string;
  readonly creatorId: string;
  readonly subscriberId: string;
  readonly planId: string;
  readonly status: string;
  readonly price: MoneyDto;
  readonly interval: string;
  readonly currentPeriodEnd: string | null;
  readonly renewsAt: string | null;
  readonly createdAt: string;
}

export interface CreatorSubscriberDto {
  readonly id: string;
  readonly user: { readonly id: string; readonly username: string; readonly name: string; readonly avatarUrl: string | null } | null;
  readonly planId: string;
  readonly planName: string;
  readonly since: string;
  readonly renewsAt: string | null;
  readonly status: string;
}

export function presentCreatorPlan(plan: CreatorPlanRecord, subscriberCount: number): CreatorPlanDto {
  return {
    id: plan.id,
    creatorId: plan.creatorId,
    name: plan.name,
    description: plan.description,
    price: Money.of(plan.price, plan.currency).toDto(),
    interval: plan.interval,
    benefits: plan.benefits.map((benefit) => benefit.name),
    benefitDetails: plan.benefits,
    subscriberCount,
    active: plan.active,
  };
}

export function presentCreatorSubscription(subscription: CreatorSubscriptionRecord): CreatorSubscriptionStateDto {
  return {
    subscriptionId: subscription.id,
    creatorId: subscription.creatorId,
    subscriberId: subscription.subscriberId,
    planId: subscription.planId,
    status: subscription.status,
    price: Money.of(subscription.amount, subscription.currency).toDto(),
    interval: subscription.interval,
    currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
    renewsAt: subscription.status === "active" ? subscription.currentPeriodEnd?.toISOString() ?? null : null,
    createdAt: subscription.createdAt.toISOString(),
  };
}

export function presentCreatorSubscriber(subscription: CreatorSubscriptionRecord, user: UserSummary | undefined, planName: string): CreatorSubscriberDto {
  return {
    id: subscription.id,
    user: user === undefined ? null : { id: user.id, username: user.username, name: user.name, avatarUrl: user.avatarUrl },
    planId: subscription.planId,
    planName,
    since: (subscription.currentPeriodStart ?? subscription.createdAt).toISOString(),
    renewsAt: subscription.status === "active" ? subscription.currentPeriodEnd?.toISOString() ?? null : null,
    status: subscription.status,
  };
}
