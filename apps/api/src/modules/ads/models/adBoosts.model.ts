import type { CurrencyCode } from "../../../enums/currency.enum.js";

export type BoostGoal = "views" | "profile_visits" | "messages";
export type BoostStatus = "pending_payment" | "in_review" | "active" | "completed" | "rejected";

export type BoostAudience =
  | { readonly mode: "automatic" }
  | { readonly mode: "custom"; readonly countryCode: string; readonly states: readonly string[]; readonly interests: readonly string[]; readonly ageMin: number; readonly ageMax: number };

export interface AdBoostRecord {
  readonly id: string;
  readonly userId: string;
  readonly postId: string;
  readonly accountId: string;
  readonly campaignId: string;
  readonly adId: string;
  readonly goal: BoostGoal;
  readonly audience: BoostAudience;
  readonly dailyBudgetMinor: number;
  readonly durationDays: number;
  readonly totalMinor: number;
  readonly currency: CurrencyCode;
  readonly status: BoostStatus;
  readonly chargeReference: string;
  readonly rejectionReason: string | null;
  readonly startsAt: Date | null;
  readonly endsAt: Date | null;
  readonly refundedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type NewAdBoostInput = Omit<AdBoostRecord, "id" | "createdAt" | "updatedAt">;
export type AdBoostChanges = Partial<Pick<AdBoostRecord, "status" | "rejectionReason" | "startsAt" | "endsAt" | "refundedAt">>;
