import type { ID, ISODate } from "./models.type";
import type { Money } from "./money.type";

export type BoostGoal = "views" | "profile_visits" | "messages" | "store_visits" | "product_visits";

export type BoostDestinationType = "post" | "profile" | "store" | "product";

export type BoostStatus = "pending_payment" | "in_review" | "active" | "paused" | "completed" | "rejected" | "cancelled";

export type BoostBudgetType = "daily" | "total";

export type BoostAudienceGender = "all" | "female" | "male";

export type BoostAudience =
  | { readonly mode: "automatic" }
  | {
      readonly mode: "custom";
      readonly countryCode: string;
      readonly states: readonly string[];
      readonly interests?: readonly string[];
      readonly topicIds?: readonly string[];
      readonly gender?: BoostAudienceGender;
      readonly ageMin: number;
      readonly ageMax: number;
    };

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

export interface BoostOptions {
  readonly minimumDailyBudget: Money;
  readonly suggestedDailyBudgets: readonly Money[];
  readonly durationDayOptions: readonly number[];
  readonly interests: readonly string[];
  readonly paymentMethods?: readonly BoostPaymentMethod[];
  readonly freeBoost?: FreeBoostAllowance | null;
  readonly region?: string;
  readonly paymentOptions?: readonly BoostPaymentOption[];
  readonly adBalance?: BoostAdBalanceSummary | null;
  readonly maximumDurationDays?: number;
  readonly maximumScheduleDays?: number;
  readonly goalsByDestination?: Partial<Record<BoostDestinationType, readonly BoostGoal[]>>;
}

export type BoostPaymentMethod = "card" | "ad_balance" | "balance" | "free";

export interface FreeBoostAllowance {
  readonly premium: boolean;
  readonly eligible: boolean;
  readonly remainingThisMonth: number;
  readonly maxTotal: Money;
  readonly resetsAt: ISODate | null;
}

export interface BoostEstimateRequest {
  readonly postId?: ID;
  readonly destinationType?: BoostDestinationType;
  readonly targetId?: ID;
  readonly goal: BoostGoal;
  readonly audience: BoostAudience;
  readonly budgetType?: BoostBudgetType;
  readonly dailyBudget: Money;
  readonly totalBudget?: Money;
  readonly durationDays: number;
  readonly startAt?: ISODate;
}

export interface BoostEstimate {
  readonly estimatedReachMin: number;
  readonly estimatedReachMax: number;
  readonly estimatedResultsLabel: string;
  readonly totalCost: Money;
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

export interface BoostActions {
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
  readonly budgetType?: BoostBudgetType;
  readonly dailyBudget?: Money;
  readonly durationDays?: number;
  readonly scheduledStartAt?: ISODate | null;
  readonly createdAt?: ISODate;
  readonly audience?: BoostAudience;
  readonly keyResult?: { readonly label: string; readonly value: number };
  readonly costPerResult?: Money | null;
  readonly actions?: BoostActions;
  readonly totalBudget: Money;
  readonly spent: Money;
  readonly startsAt: ISODate | null;
  readonly endsAt: ISODate | null;
  readonly results: BoostResults;
  readonly rejectionReason: string | null;
  readonly paymentMethod?: BoostPaymentMethod | "wallet";
}

export interface CreatedBoost {
  readonly boost: Boost;
  readonly checkoutUrl: string | null;
}
