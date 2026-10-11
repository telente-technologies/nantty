import type { Money } from "./money.type";

export type PayoutRole = "seller" | "creator" | "both";
export type PayoutOnboardingStep = "identity" | "business" | "bank" | "document";
export type PayoutOnboardingStatus = "not_started" | "in_progress" | "pending_review" | "action_needed" | "verified";
export type PayoutAccountStatus = "pending_creation" | "documentsRequired" | "underReview" | "failed" | "actionRequired" | "verified";

export interface PayoutOnboardingSummary {
  readonly role: PayoutRole;
  readonly status: PayoutOnboardingStatus;
  readonly currentStep: PayoutOnboardingStep;
  readonly completedSteps: readonly PayoutOnboardingStep[];
  readonly accountStatus: PayoutAccountStatus | null;
  readonly pendingWithdrawable: Money | null;
  readonly withdrawalsEnabled: boolean;
  readonly firstEarningsUnlockAt: string | null;
}
