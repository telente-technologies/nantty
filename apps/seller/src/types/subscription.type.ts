import type { Money } from "@/types/money.type";
import type { SubscriptionSummary } from "@/types/sellerAccess.type";

export interface SubscriptionPlan {
  readonly id: string;
  readonly name: string;
  readonly tagline: string;
  readonly price: Money;
  readonly interval: "month" | "year";
  readonly trialDays: number;
  readonly limits: { readonly locations: number | null; readonly registers: number | null; readonly staff: number | null; readonly products: number | null };
  readonly features: string[];
  readonly recommended: boolean;
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

export interface SubscriptionDetails extends SubscriptionSummary {
  readonly cancelAtPeriodEnd: boolean;
  readonly paymentMethodSummary: string | null;
  readonly provider: "paystack" | "flutterwave" | null;
  readonly invoices: SubscriptionInvoice[];
}
