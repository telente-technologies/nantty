import type { ID, ISODate } from "./models.type";
import type { Money } from "./money.type";

export type BoostGoal = "views" | "profile_visits" | "messages";

export type BoostAudience =
  | { readonly mode: "automatic" }
  | { readonly mode: "custom"; readonly countryCode: string; readonly states: readonly string[]; readonly interests: readonly string[]; readonly ageMin: number; readonly ageMax: number };

export interface BoostOptions {
  readonly minimumDailyBudget: Money;
  readonly suggestedDailyBudgets: readonly Money[];
  readonly durationDayOptions: readonly number[];
  readonly interests: readonly string[];
  readonly paymentMethods?: readonly BoostPaymentMethod[];
  readonly freeBoost?: FreeBoostAllowance | null;
}

export type BoostPaymentMethod = "card" | "balance" | "free";

export interface FreeBoostAllowance {
  readonly premium: boolean;
  readonly eligible: boolean;
  readonly remainingThisMonth: number;
  readonly maxTotal: Money;
  readonly resetsAt: ISODate | null;
}

export interface BoostEstimateRequest {
  readonly postId: ID;
  readonly goal: BoostGoal;
  readonly audience: BoostAudience;
  readonly dailyBudget: Money;
  readonly durationDays: number;
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
  readonly messages: number;
}

export interface Boost {
  readonly id: ID;
  readonly postId: ID;
  readonly status: "pending_payment" | "in_review" | "active" | "completed" | "rejected" | "cancelled";
  readonly goal: BoostGoal;
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
