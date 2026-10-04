export type IdentityCaseStatus = "awaiting_consent" | "awaiting_capture" | "processing" | "under_review" | "approved" | "rejected";
export type IdentityRefundStatus = "not_applicable" | "requested" | "refunded" | "not_charged" | "failed" | "manual_store_refund";
export type IdentityCheckResult = "passed" | "failed" | "review" | "not_done" | "pending" | "matched";

export interface IdentityCaseChecks {
  readonly liveness: IdentityCheckResult;
  readonly document: IdentityCheckResult;
  readonly faceMatch: IdentityCheckResult;
  readonly databaseLookup: IdentityCheckResult;
  readonly faceMatchConfidence: number;
  readonly nameMatchScore: number;
}

export interface IdentityCase {
  readonly id: string;
  readonly profileId: string;
  readonly accountId: string;
  readonly color: "blue" | "gold";
  readonly planCode: string;
  readonly paymentChannel: string;
  readonly status: IdentityCaseStatus;
  readonly refundStatus: IdentityRefundStatus;
  readonly refundMethod: string;
  readonly consentGiven: boolean;
  readonly documentType: string;
  readonly documentCountry: string;
  readonly checks: IdentityCaseChecks;
  readonly trustScore: number;
  readonly eligibleAtPayment: boolean;
  readonly decisionReasons: readonly string[];
  readonly fraudSignals: readonly string[];
  readonly decisionReason: string;
  readonly decidedByName?: string;
  readonly smileReference?: string;
  readonly smileResultCode?: string;
  readonly createdAt: string;
  readonly decidedAt: string | null;
  readonly verifiedAt: string | null;
}

export interface IdentityCaseListItem extends IdentityCase {
  readonly profileHandle: string;
  readonly profileName: string;
}

export interface IdentityCaseDetail {
  readonly case: IdentityCase;
  readonly profile: { readonly handle: string; readonly displayName: string; readonly profileType: string; readonly accountName: string; readonly accountStatus: string; readonly joinedAt: string };
  readonly health: { readonly realFollowers: number; readonly daysSinceLastViolation: number; readonly fraudScore: number; readonly riskScore: number; readonly borderlineContent: boolean };
  readonly eligibility: { readonly state: string; readonly tier: string; readonly trustScore: number; readonly reasons: readonly string[] } | null;
}

export type IdentityCaseDecision = "approve" | "reject";
