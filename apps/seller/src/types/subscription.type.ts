import type { Money } from "@/types/money.type";
import type { GoldEntitlements, GoldTier, SubscriptionSummary } from "@/types/sellerAccess.type";

export interface SubscriptionPlanPerk {
  readonly title: string;
  readonly description: string;
}

export interface SubscriptionPlan {
  readonly id: string;
  readonly tier: GoldTier;
  readonly price: Money;
  readonly interval: "month" | "year";
  readonly entitlements: GoldEntitlements;
  readonly perks: SubscriptionPlanPerk[];
}

export interface SubscriptionInvoice {
  readonly id: string;
  readonly number: string;
  readonly amount: Money;
  readonly status: "paid" | "open" | "failed";
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly paidAt: string | null;
}

export interface SubscriptionDetails {
  readonly subscription: SubscriptionSummary | null;
  readonly planId: string | null;
  readonly cancelAtPeriodEnd: boolean;
  readonly paymentMethodSummary: string | null;
  readonly provider: "paystack" | "flutterwave" | null;
  readonly invoices: SubscriptionInvoice[];
}
