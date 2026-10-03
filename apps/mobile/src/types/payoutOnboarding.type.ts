import type { CurrencyCode, Money } from "./money.type";

export type PayoutRole = "seller" | "creator" | "both";
export type PayoutOnboardingStep = "identity" | "business" | "bank" | "document";
export type PayoutOnboardingStatus = "not_started" | "in_progress" | "pending_review" | "action_needed" | "verified";
export type PayoutAccountStatus = "pending_creation" | "documentsRequired" | "underReview" | "failed" | "actionRequired" | "verified";
export type PayoutSyncStatus = "saved" | "sending" | "done" | "needs_attention";
export type PayoutIdType = "bvn" | "nin";
export type PayoutDocumentStatus = "not_started" | "link_issued" | "uploaded" | "rejected" | "approved";

export interface PayoutIdentityInput {
  readonly legalName: string;
  readonly dateOfBirth: string;
  readonly addressLine1: string;
  readonly city: string;
  readonly state: string;
  readonly idType: PayoutIdType;
  readonly idNumber: string;
  readonly registeredBusiness: boolean;
}

export interface PayoutBusinessInput {
  readonly cacNumber: string;
  readonly businessType: "sole_proprietorship" | "partnership" | "limited_company";
}

export interface PayoutBankInput {
  readonly bankCode: string;
  readonly bankName: string;
  readonly accountNumber: string;
  readonly resolvedAccountName: string;
}

export interface PayoutActionReason {
  readonly step: PayoutOnboardingStep;
  readonly code: string;
  readonly message: string;
}

export interface PayoutOnboardingState {
  readonly role: PayoutRole;
  readonly status: PayoutOnboardingStatus;
  readonly currentStep: PayoutOnboardingStep;
  readonly completedSteps: readonly PayoutOnboardingStep[];
  readonly requiresBusinessStep: boolean;
  readonly requiresDocumentStep: boolean;
  readonly legalName: string | null;
  readonly idType: PayoutIdType | null;
  readonly idLast4: string | null;
  readonly bankSummary: string | null;
  readonly documentStatus: PayoutDocumentStatus;
  readonly accountStatus: PayoutAccountStatus | null;
  readonly syncByStep: Partial<Record<PayoutOnboardingStep, PayoutSyncStatus>>;
  readonly earningsPendingTransfer: boolean;
  readonly pendingWithdrawable: Money | null;
  readonly reviewEstimate: string | null;
  readonly reasons: readonly PayoutActionReason[];
  readonly verifiedVia: "seller" | "creator" | null;
  readonly withdrawalsEnabled: boolean;
  readonly firstEarningsUnlockAt: string | null;
}

export interface PayoutDocumentLink {
  readonly url: string;
  readonly returnUrl: string;
  readonly expiresAt: string;
}

export interface PayoutFees {
  readonly currency: CurrencyCode;
  readonly kind: "flat";
  readonly fee: Money;
  readonly arrivalEstimate: string;
  readonly firstPayoutNote: string;
}
