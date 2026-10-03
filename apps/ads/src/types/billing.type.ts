import type { Money } from "@/types/money.type";

export type FundingMode = "prepaid" | "card" | "prepaid_and_card";
export type PaymentProvider = "paystack";

export interface PaymentMethod {
  readonly id: string;
  readonly brand: string;
  readonly last4: string;
  readonly expMonth: number;
  readonly expYear: number;
  readonly isDefault: boolean;
  readonly provider: PaymentProvider;
}

export interface AdCredits {
  readonly available: Money;
  readonly monthlyGrant: Money | null;
  readonly expiresAt: string | null;
  readonly source: "gold_premium" | "promotion" | null;
}

export interface SpendLimit {
  readonly amount: Money | null;
  readonly spent: Money;
}

export interface BillingOverview {
  readonly balance: Money;
  readonly credits: AdCredits;
  readonly spendLimit: SpendLimit;
  readonly fundingMode: FundingMode;
  readonly paymentMethods: readonly PaymentMethod[];
  readonly lowBalanceThreshold: Money;
  readonly estimatedDaysOfDelivery: number | null;
  readonly minimumTopUp: Money;
  readonly maximumTopUp: Money;
  readonly suggestedTopUps: readonly Money[];
}

export type TopUpStatus = "pending" | "succeeded" | "failed" | "abandoned";

export interface TopUpCheckout {
  readonly topUpId: string;
  readonly reference: string;
  readonly provider: PaymentProvider;
  readonly authorizationUrl: string;
  readonly accessCode: string;
}

export interface TopUp {
  readonly id: string;
  readonly reference: string;
  readonly amount: Money;
  readonly status: TopUpStatus;
  readonly provider: PaymentProvider;
  readonly createdAt: string;
  readonly completedAt: string | null;
  readonly failureReason: string | null;
}

export type BillingTransactionType = "top_up" | "ad_spend" | "credit_grant" | "credit_spend" | "refund" | "card_charge";

export interface BillingTransaction {
  readonly id: string;
  readonly type: BillingTransactionType;
  readonly amount: Money;
  readonly description: string;
  readonly reference: string;
  readonly createdAt: string;
  readonly receiptAvailable: boolean;
}

export type InvoiceStatus = "paid" | "open" | "void";

export interface Invoice {
  readonly id: string;
  readonly number: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly subtotal: Money;
  readonly tax: Money;
  readonly total: Money;
  readonly status: InvoiceStatus;
  readonly issuedAt: string;
}
