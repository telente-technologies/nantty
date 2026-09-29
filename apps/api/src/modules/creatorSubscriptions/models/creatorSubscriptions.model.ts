import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { MinorUnits } from "../../../types/money.type.js";

export const CREATOR_SUBSCRIPTION_REFERENCE_PREFIX = "zmcsub_";

export type CreatorPlanInterval = "month" | "year";
export type CreatorSubscriptionStatus = "pending" | "active" | "past_due" | "cancelled" | "expired" | "failed";
export type CreatorSubscriptionChargeKind = "initial" | "renewal";
export type CreatorSubscriptionChargeStatus = "pending" | "succeeded" | "failed";

export const SUBSCRIBER_ACCESS_STATUSES: readonly CreatorSubscriptionStatus[] = ["active", "past_due", "cancelled"];

export interface PlanBenefit {
  readonly name: string;
  readonly description: string;
}

export interface CreatorPlanRecord {
  readonly id: string;
  readonly creatorId: string;
  readonly name: string;
  readonly description: string;
  readonly price: MinorUnits;
  readonly currency: CurrencyCode;
  readonly interval: CreatorPlanInterval;
  readonly benefits: readonly PlanBenefit[];
  readonly active: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type NewCreatorPlan = Omit<CreatorPlanRecord, "id" | "updatedAt">;
export type CreatorPlanChange = Partial<Pick<CreatorPlanRecord, "name" | "description" | "benefits" | "active">>;

export interface CreatorSubscriptionRecord {
  readonly id: string;
  readonly subscriberId: string;
  readonly creatorId: string;
  readonly planId: string;
  readonly status: CreatorSubscriptionStatus;
  readonly provider: string;
  readonly amount: MinorUnits;
  readonly currency: CurrencyCode;
  readonly interval: CreatorPlanInterval;
  readonly authorizationEncrypted: string | null;
  readonly payerEmail: string | null;
  readonly currentPeriodStart: Date | null;
  readonly currentPeriodEnd: Date | null;
  readonly createdAt: Date;
}

export type NewCreatorSubscription = Pick<CreatorSubscriptionRecord, "subscriberId" | "creatorId" | "planId" | "provider" | "amount" | "currency" | "interval" | "createdAt">;
export type CreatorSubscriptionChange = Partial<Pick<CreatorSubscriptionRecord, "status" | "authorizationEncrypted" | "payerEmail" | "currentPeriodStart" | "currentPeriodEnd" | "planId" | "provider">>;

export interface CreatorSubscriptionChargeRecord {
  readonly id: string;
  readonly subscriptionId: string;
  readonly subscriberId: string;
  readonly creatorId: string;
  readonly kind: CreatorSubscriptionChargeKind;
  readonly reference: string;
  readonly provider: string;
  readonly amount: MinorUnits;
  readonly currency: CurrencyCode;
  readonly status: CreatorSubscriptionChargeStatus;
  readonly providerTransactionId: string | null;
  readonly paidAt: Date | null;
  readonly createdAt: Date;
}

export type NewCreatorSubscriptionCharge = Pick<CreatorSubscriptionChargeRecord, "subscriptionId" | "subscriberId" | "creatorId" | "kind" | "reference" | "provider" | "amount" | "currency" | "createdAt">;

export function hasSubscriberAccess(subscription: CreatorSubscriptionRecord, now: Date): boolean {
  return SUBSCRIBER_ACCESS_STATUSES.includes(subscription.status) && subscription.currentPeriodEnd !== null && subscription.currentPeriodEnd > now;
}

export function addBillingInterval(start: Date, interval: CreatorPlanInterval, monthDays: number): Date {
  const days = interval === "year" ? 365 : monthDays;
  return new Date(start.getTime() + days * 86_400_000);
}
