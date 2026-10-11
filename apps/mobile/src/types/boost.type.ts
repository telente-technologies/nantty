import type { ID, ISODate } from "./models.type";
import type { Money } from "./money.type";

export type BoostGoal = "views" | "profile_visits" | "messages";

export type BoostAudience =
  | { readonly mode: "automatic" }
  | { readonly mode: "custom"; readonly countryCode: string; readonly states: readonly string[]; readonly interests: readonly string[]; readonly ageMin: number; readonly ageMax: number };

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

export type BoostPaymentMethod = "card" | "balance" | "free";

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
