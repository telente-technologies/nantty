export type IdentityCaseStatus = "awaiting_consent" | "awaiting_capture" | "processing" | "under_review" | "approved" | "rejected";
export type IdentityRefundStatus = "not_applicable" | "requested" | "refunded" | "not_charged" | "failed" | "manual_store_refund";

export interface IdentityEligibility {
  readonly state: "assessed" | "requested" | "eligible";
  readonly tier: "buy_now" | "request" | "blocked";
  readonly trustScore: number;
  readonly reasons: readonly string[];
  readonly canBuyNow: boolean;
  readonly requestedAt: string | null;
  readonly nextCheckAt: string | null;
}

export interface IdentityCase {
  readonly id: string;
  readonly color: "blue" | "gold";
  readonly planCode: string;
  readonly paymentChannel: string;
  readonly status: IdentityCaseStatus;
  readonly refundStatus: IdentityRefundStatus;
  readonly refundMethod: "card" | "google_play" | "apple_request" | "plan_continues";
  readonly consentGiven: boolean;
  readonly decisionReason: string;
  readonly createdAt: string;
  readonly decidedAt: string | null;
  readonly verifiedAt: string | null;
  readonly canRetry: boolean;
}

export interface IdentityJourney {
  readonly profileId: string;
  readonly profileType: string;
  readonly color: "blue" | "gold" | "black";
  readonly blackVetting: boolean;
  readonly planCode: string;
  readonly consentVersion: string;
  readonly eligibility: IdentityEligibility | null;
  readonly case: IdentityCase | null;
  readonly checkmark: { readonly color: string; readonly status: string; readonly badgeVisible: boolean } | null;
}

export interface IdentityDocumentTypes {
  readonly country: string;
  readonly documentTypes: readonly string[];
  readonly governmentLookup: boolean;
}

export interface IdentityCaptureSession {
  readonly mode: "hosted_link" | "web_integration";
  readonly url?: string;
  readonly token?: string;
  readonly product: string;
  readonly jobId: string;
}
