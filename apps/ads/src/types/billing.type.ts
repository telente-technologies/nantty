import type { Money } from "@/types/money.type";

export type FundingMode = "prepaid" | "card" | "prepaid_and_card";
export type PaymentProvider = "flutterwave";

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
  readonly checkoutUrl?: string | null;
  readonly authorizationUrl: string;
  readonly accessCode?: string;
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

export type BillingTransactionType = "top_up" | "ad_spend" | "credit_grant" | "credit_spend" | "refund" | "card_charge" | "ad_spend_debt";

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

export interface RegionalAdPricingRow {
  readonly region: string;
  readonly currency: string;
  readonly cpmFloorMinor: number;
  readonly cpcFloorMinor: number;
  readonly minimumDailyBudgetMinor: number;
  readonly boostMinimumDailyMinor: number;
  readonly suggestedCpmMinor: number;
  readonly suggestedCpcMinor: number;
  readonly suggestedCpvMinor: number;
  readonly suggestedDailyBudgetMinor: number;
}

export interface RegionalAdPricing {
  readonly billingCurrency: string;
  readonly targetedRegions: readonly string[];
  readonly cpmFloor: Money;
  readonly cpcFloor: Money;
  readonly minimumDailyBudget: Money;
  readonly boostMinimumDailyBudget: Money;
  readonly suggestedCpm: Money;
  readonly suggestedCpc: Money;
  readonly suggestedCpv: Money;
  readonly suggestedDailyBudget: Money;
  readonly creatorRevenueSharePercent: number;
  readonly regions: readonly RegionalAdPricingRow[];
}

export interface EstimateRange {
  readonly low: number;
  readonly high: number;
}

export interface RegionCostEstimate {
  readonly region: string;
  readonly localCurrency: string;
  readonly budgetShareBps: number;
  readonly dailyBudgetMinor: number;
  readonly totalBudgetMinor: number;
  readonly minimumDailyBudgetMinor: number;
  readonly suggestedDailyBudgetMinor: number;
  readonly suggestedCpmMinor: number;
  readonly suggestedCpcMinor: number;
  readonly impressions: EstimateRange;
  readonly reach: EstimateRange;
  readonly clicks: EstimateRange;
  readonly videoViews: EstimateRange;
  readonly results: EstimateRange;
  readonly costPerResultMinor: EstimateRange;
  readonly belowRegionMinimum: boolean;
  readonly exchangeNote?: string;
}

export interface CampaignCostEstimate {
  readonly billingCurrency: string;
  readonly days: number;
  readonly dailyBudgetMinor: number;
  readonly totalCostMinor: number;
  readonly minimumDailyBudgetMinor: number;
  readonly suggestedDailyBudgetMinor: number;
  readonly suggestedLifetimeBudgetMinor: number;
  readonly resultKind: "reach" | "clicks" | "video_views" | "follows" | "messages";
  readonly impressions: EstimateRange;
  readonly reach: EstimateRange;
  readonly clicks: EstimateRange;
  readonly videoViews: EstimateRange;
  readonly results: EstimateRange;
  readonly costPerResultMinor: EstimateRange;
  readonly belowMinimum: boolean;
  readonly regions: readonly RegionCostEstimate[];
}

export interface CampaignCostEstimateRequest {
  readonly countries: readonly string[];
  readonly currency: string;
  readonly budget: { readonly type: "daily" | "lifetime"; readonly amountMinor: number };
  readonly startAt?: string;
  readonly endAt?: string;
  readonly days?: number;
  readonly objective: string;
}
