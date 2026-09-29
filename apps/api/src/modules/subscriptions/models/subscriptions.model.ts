import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { EntitlementKey, EntitlementValue } from "../../../interfaces/entitlements.interface.js";
import type { ProfileType, VerificationColor, VerificationTier } from "../../../interfaces/verificationBadge.interface.js";
import type { MinorUnits } from "../../../types/money.type.js";
import type { ProfileKind } from "../../verifications/models/verifications.model.js";

export const SUBSCRIPTION_STATUSES = ["ACTIVE", "TRIALING", "PAST_DUE", "CANCELLED", "EXPIRED", "SUSPENDED"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const BILLING_INTERVALS = ["MONTHLY", "YEARLY"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export const PAID_PLAN_TIERS = ["ESSENTIAL", "VERIFIED", "PREMIUM", "PRO"] as const;

export interface PlanPrice {
  readonly interval: BillingInterval;
  readonly currency: CurrencyCode;
  readonly amount: MinorUnits;
}

export interface PlanEntitlement {
  readonly key: EntitlementKey;
  readonly value: EntitlementValue;
}

export interface PlanPerk {
  readonly title: string;
  readonly description: string;
}

export interface PlanRecord {
  readonly id: string;
  readonly color: VerificationColor;
  readonly tier: VerificationTier;
  readonly name: string;
  readonly description: string;
  readonly purchasable: boolean;
  readonly trialDays: number;
  readonly active: boolean;
  readonly sortOrder: number;
  readonly prices: readonly PlanPrice[];
  readonly entitlements: readonly PlanEntitlement[];
  readonly perks: readonly PlanPerk[];
}

export type PlanChanges = Partial<Pick<PlanRecord, "name" | "description" | "trialDays" | "active" | "sortOrder">>;

export interface SubscriptionRecord {
  readonly id: string;
  readonly profileId: string;
  readonly profileKind: ProfileKind;
  readonly profileType: ProfileType;
  readonly ownerUserId: string;
  readonly plan: VerificationTier;
  readonly status: SubscriptionStatus;
  readonly autoRenew: boolean;
  readonly interval: BillingInterval;
  readonly provider: string | null;
  readonly currency: CurrencyCode | null;
  readonly amount: MinorUnits | null;
  readonly authorizationEncrypted: string | null;
  readonly payerEmail: string | null;
  readonly startsAt: Date;
  readonly endsAt: Date | null;
  readonly trialEndsAt: Date | null;
  readonly trialUsed: boolean;
  readonly pastDueSince: Date | null;
  readonly cancelledAt: Date | null;
  readonly lastChargeAttemptAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type NewSubscription = Omit<SubscriptionRecord, "id" | "createdAt" | "updatedAt">;

export type SubscriptionPatch = Partial<Omit<SubscriptionRecord, "id" | "profileId" | "profileKind" | "profileType" | "ownerUserId" | "createdAt" | "updatedAt">>;

export interface SubscriptionFilter {
  readonly status?: SubscriptionStatus | undefined;
  readonly plan?: VerificationTier | undefined;
}

export type ChargeKind = "initial" | "renewal";
export type ChargeStatus = "pending" | "succeeded" | "failed";

export interface SubscriptionChargeRecord {
  readonly id: string;
  readonly profileId: string;
  readonly profileKind: ProfileKind;
  readonly profileType: ProfileType;
  readonly ownerUserId: string;
  readonly payerUserId: string;
  readonly plan: VerificationTier;
  readonly interval: BillingInterval;
  readonly kind: ChargeKind;
  readonly reference: string;
  readonly provider: string;
  readonly amount: MinorUnits;
  readonly currency: CurrencyCode;
  readonly status: ChargeStatus;
  readonly providerTransactionId: string | null;
  readonly paidAt: Date | null;
  readonly createdAt: Date;
}

export type NewSubscriptionCharge = Omit<SubscriptionChargeRecord, "id" | "status" | "providerTransactionId" | "paidAt" | "createdAt">;

export const SUBSCRIPTION_REFERENCE_PREFIX = "zmsub_";
