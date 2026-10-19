import type { Boost, BoostPaymentOption } from "./boost.type";
import type { ISODate } from "./models.type";
import type { Money } from "./money.type";

export interface BoostListPage {
  readonly data: readonly Boost[];
  readonly nextCursor: string | null;
}

export interface BoostBudgetChangeRequest {
  readonly extraDays: number;
  readonly dailyBudget?: Money;
  readonly additionalBudget?: Money;
}

export type BoostBudgetChangePaymentMethod = "card" | "ad_balance";

export interface BoostBudgetQuote {
  readonly additionalCost: Money;
  readonly newDailyBudget: Money;
  readonly newTotalBudget: Money;
  readonly newDurationDays: number;
  readonly newEndsAt: ISODate | null;
  readonly paymentOptions: readonly BoostPaymentOption[];
}

export interface BoostBudgetChangeResult {
  readonly boost: Boost;
  readonly change: { readonly id: string; readonly status: "applied" | "pending_payment"; readonly additionalCost: Money };
  readonly checkoutUrl: string | null;
}

export interface BoostReportMetrics {
  readonly impressions: number;
  readonly reach: number;
  readonly clicks: number;
  readonly results: number;
  readonly spend: Money;
}

export interface BoostReport {
  readonly currency: string;
  readonly resultLabel: string;
  readonly totals: BoostReportMetrics & { readonly costPerResult: Money | null };
  readonly series: readonly (BoostReportMetrics & { readonly date: string })[];
}

export interface AdBalanceTopUpAvailability {
  readonly available: boolean;
  readonly reasonCode: string | null;
  readonly reason: string | null;
  readonly minimum: Money;
  readonly maximum: Money;
  readonly suggested: readonly Money[];
}

export type AdCreditSource = "admin_issued" | "cashback" | "premium_free_boost" | "boost_refund" | "legacy";

export interface AdCreditLot {
  readonly id: string;
  readonly source: AdCreditSource;
  readonly remaining: Money;
  readonly expiresAt: ISODate | null;
  readonly reason: string | null;
  readonly createdAt: ISODate;
}

export interface AdBalanceWithdrawalAvailability {
  readonly available: boolean;
  readonly reasonCode: string | null;
  readonly reason: string | null;
  readonly minimum: Money;
}

export interface AdBalance {
  readonly accountId: string | null;
  readonly balance: Money;
  readonly credit: Money;
  readonly committed: Money;
  readonly spendable: Money;
  readonly withdrawable: Money;
  readonly pendingSettlement: Money;
  readonly creditLots: readonly AdCreditLot[];
  readonly cashback: { readonly enabled: boolean; readonly percent: number };
  readonly topUp: AdBalanceTopUpAvailability;
  readonly withdrawal: AdBalanceWithdrawalAvailability;
}

export type AdBalanceTransactionKind =
  | "top_up" | "boost_funding" | "earnings_funding" | "spent" | "refund" | "withdrawal" | "credit_issued" | "cashback" | "cashback_reversed" | "credit_spent" | "credit_expired" | "credit_revoked" | "debt";

export interface AdBalanceTransaction {
  readonly id: string;
  readonly pot: "balance" | "credit";
  readonly kind: AdBalanceTransactionKind;
  readonly amount: Money;
  readonly description: string;
  readonly createdAt: ISODate;
}

export interface AdBalanceTransactionPage {
  readonly data: readonly AdBalanceTransaction[];
  readonly nextCursor: string | null;
}

export interface AdBalanceWithdrawalQuote {
  readonly amount: Money;
  readonly fee: Money;
  readonly net: Money;
  readonly destination: "wallet";
  readonly withdrawable: Money;
}

export interface AdBalanceWithdrawal {
  readonly id: string;
  readonly status: "completed";
  readonly amount: Money;
  readonly fee: Money;
  readonly net: Money;
  readonly destination: "wallet";
  readonly createdAt: ISODate;
}

export interface AdBalanceTopUpCheckout {
  readonly topUpId: string;
  readonly reference: string;
  readonly checkoutUrl: string;
}

export interface AdLocationTarget {
  readonly type: "country" | "state" | "city";
  readonly code: string;
  readonly name: string;
  readonly countryCode: string;
  readonly parentName: string | null;
}
