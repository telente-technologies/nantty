import type { Money } from "@/types/money.type";
import type { SubscriptionPlanTier } from "@/types/sellerAccess.type";

export type TrialLength = "DAYS_7" | "MONTH_1";

export interface TrialIneligibleReason {
  readonly code: string;
  readonly message: string;
}

export interface TrialReminder {
  readonly daysBefore: 3 | 1;
  readonly sendsAt: string;
}

export interface ActiveTrial {
  readonly planId: string;
  readonly tier: SubscriptionPlanTier;
  readonly interval: "month" | "year";
  readonly startedAt: string;
  readonly endsAt: string;
  readonly daysLeft: number;
  readonly isCancelled: boolean;
  readonly cardSummary: string;
  readonly priceAfterTrial: Money;
  readonly verificationCharge: { readonly amount: Money; readonly status: "REFUNDED" | "REFUND_PENDING" };
  readonly reminders?: readonly TrialReminder[];
}

export interface BillingOffer {
  readonly profileName: string;
  readonly accountEmail?: string;
  readonly trialLength: TrialLength;
  readonly trialDays: number;
  readonly yearlyDiscountPercent: number;
  readonly verificationCharge: Money;
  readonly isEligible: boolean;
  readonly ineligibleReasons: readonly TrialIneligibleReason[];
  readonly activeTrial: ActiveTrial | null;
  readonly bundle: { readonly hasActiveBlue: boolean; readonly discountPercent: number; readonly maximumBusinesses: number };
  readonly goldOnlyPlan: { readonly monthly: Money; readonly yearly: Money; readonly isActive?: boolean };
}
