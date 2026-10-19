import type { ID, ISODate } from "./models.type";
import type { Money } from "./money.type";

export type BoostGoal = "views" | "profile_visits" | "messages" | "store_visits" | "product_visits";

export type BoostDestinationType = "post" | "profile" | "store" | "product";

export type BoostAudienceGender = "all" | "female" | "male";

export type BoostBudgetType = "daily" | "total";

export type BoostStatus = "pending_payment" | "in_review" | "active" | "paused" | "completed" | "rejected" | "cancelled";

export type BoostAudience =
  | { readonly mode: "automatic" }
  | {
      readonly mode: "custom";
      readonly countryCode: string;
      readonly states: readonly string[];
      readonly interests: readonly string[];
      readonly ageMin: number;
      readonly ageMax: number;
      readonly gender?: BoostAudienceGender;
      readonly topicIds?: readonly string[];
    };

export interface EstimateRange {
  readonly low: number;
  readonly high: number;
}

export interface BoostPackage {
  readonly priceMinor: number;
  readonly currency: Money["currency"];
  readonly days: number;
  readonly label: string;
  readonly estimatedReach: EstimateRange;
  readonly impressions: EstimateRange;
}

export type BoostPaymentMethod = "card" | "ad_balance" | "balance" | "free";

export interface BoostPaymentOption {
  readonly method: BoostPaymentMethod;
  readonly available: boolean;
  readonly reasonCode: string | null;
  readonly reason: string | null;
}

export interface BoostAdBalanceSummary {
  readonly accountId: string | null;
  readonly balance: Money;
  readonly credit: Money;
  readonly committed: Money;
  readonly spendable: Money;
}

export interface FreeBoostAllowance {
  readonly premium: boolean;
  readonly eligible: boolean;
  readonly remainingThisMonth: number;
  readonly maxTotal: Money;
  readonly resetsAt: ISODate | null;
}

export interface BoostOptions {
  readonly minimumDailyBudget: Money;
  readonly suggestedDailyBudgets: readonly Money[];
  readonly durationDayOptions: readonly number[];
  readonly interests: readonly string[];
  readonly region?: string;
  readonly packages?: readonly BoostPackage[];
  readonly paymentMethods?: readonly BoostPaymentMethod[];
  readonly freeBoost?: FreeBoostAllowance | null;
  readonly paymentOptions?: readonly BoostPaymentOption[];
  readonly adBalance?: BoostAdBalanceSummary | null;
  readonly maximumDurationDays?: number;
  readonly maximumScheduleDays?: number;
  readonly goalsByDestination?: Partial<Record<BoostDestinationType, readonly BoostGoal[]>>;
}

export interface BoostEstimateRequest {
  readonly postId?: ID;
  readonly destinationType?: BoostDestinationType;
  readonly targetId?: ID;
  readonly goal: BoostGoal;
  readonly audience: BoostAudience;
  readonly dailyBudget: Money;
  readonly durationDays: number;
  readonly budgetType?: BoostBudgetType;
  readonly totalBudget?: Money;
  readonly startAt?: ISODate;
}

export interface BoostEstimate {
  readonly estimatedReachMin: number;
  readonly estimatedReachMax: number;
  readonly estimatedResultsLabel: string;
  readonly totalCost: Money;
  readonly impressions?: EstimateRange;
  readonly clicks?: EstimateRange;
  readonly costPerResultMinor?: EstimateRange;
  readonly minimumDailyBudget?: Money;
  readonly region?: string;
}

export interface CreateBoostRequest extends BoostEstimateRequest {
  readonly paymentMethod: BoostPaymentMethod;
}

export interface BoostResults {
  readonly impressions: number;
  readonly reach: number;
  readonly profileVisits: number;
  readonly storeVisits?: number;
  readonly productVisits?: number;
  readonly clicks?: number;
  readonly messages: number;
}

export interface BoostAvailableActions {
  readonly pause: boolean;
  readonly resume: boolean;
  readonly stop: boolean;
  readonly changeBudget: boolean;
  readonly resubmit: boolean;
}

export interface Boost {
  readonly id: ID;
  readonly postId: ID;
  readonly destinationType?: BoostDestinationType;
  readonly targetId?: ID;
  readonly status: BoostStatus;
  readonly goal: BoostGoal;
  readonly totalBudget: Money;
  readonly spent: Money;
  readonly startsAt: ISODate | null;
  readonly endsAt: ISODate | null;
  readonly results: BoostResults;
  readonly rejectionReason: string | null;
  readonly paymentMethod?: BoostPaymentMethod | "wallet";
  readonly budgetType?: BoostBudgetType;
  readonly dailyBudget?: Money;
  readonly durationDays?: number;
  readonly scheduledStartAt?: ISODate | null;
  readonly createdAt?: ISODate;
  readonly audience?: BoostAudience;
  readonly keyResult?: { readonly label: string; readonly value: number };
  readonly costPerResult?: Money | null;
  readonly actions?: BoostAvailableActions;
}

export interface CreatedBoost {
  readonly boost: Boost;
  readonly checkoutUrl: string | null;
}

export interface BoostBudgetChangeInput {
  readonly extraDays: number;
  readonly dailyBudget?: Money;
  readonly additionalBudget?: Money;
}

export interface BoostBudgetChangeRequest extends BoostBudgetChangeInput {
  readonly paymentMethod: "card" | "ad_balance";
}

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
  readonly change: { readonly id: ID; readonly status: "applied" | "pending_payment"; readonly additionalCost: Money };
  readonly checkoutUrl: string | null;
}

export interface BoostReportPoint {
  readonly date: string;
  readonly impressions: number;
  readonly reach: number;
  readonly clicks: number;
  readonly results: number;
  readonly spend: Money;
}

export interface BoostReport {
  readonly currency: Money["currency"];
  readonly resultLabel: string;
  readonly totals: { readonly impressions: number; readonly reach: number; readonly clicks: number; readonly results: number; readonly spend: Money; readonly costPerResult: Money | null };
  readonly series: readonly BoostReportPoint[];
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
  readonly id: ID;
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
  | "top_up" | "boost_funding" | "earnings_funding" | "spent" | "refund" | "withdrawal" | "credit_issued" | "cashback"
  | "cashback_reversed" | "credit_spent" | "credit_expired" | "credit_revoked" | "debt";

export interface AdBalanceTransaction {
  readonly id: ID;
  readonly pot: "balance" | "credit";
  readonly kind: AdBalanceTransactionKind;
  readonly amount: Money;
  readonly description: string;
  readonly createdAt: ISODate;
}

export interface AdBalanceWithdrawalQuote {
  readonly amount: Money;
  readonly fee: Money;
  readonly net: Money;
  readonly destination: "wallet";
  readonly withdrawable: Money;
}

export interface AdBalanceWithdrawal {
  readonly id: ID;
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

export interface AdTargetingLocation {
  readonly type: "country" | "state" | "city";
  readonly code: string;
  readonly name: string;
  readonly countryCode: string;
  readonly parentName: string | null;
}
