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
  readonly refundScope: "full" | "checkmark_share";
  readonly consentGiven: boolean;
  readonly decisionReason: string;
  readonly createdAt: string;
  readonly decidedAt: string | null;
  readonly verifiedAt: string | null;
  readonly canRetry: boolean;
  readonly retryableProviderError: boolean;
}

export interface IdentityJourney {
  readonly profileId: string;
  readonly profileType: string;
  readonly color: "blue" | "gold" | "black";
  readonly blackVetting: boolean;
  readonly planCode: string;
  readonly consentVersion: string;
  readonly privacyPolicyUrl: string;
  readonly eligibility: IdentityEligibility | null;
  readonly case: IdentityCase | null;
  readonly checkmark: { readonly color: string; readonly status: string; readonly badgeVisible: boolean } | null;
}

export interface IdentityDocumentTypes {
  readonly country: string;
  readonly catalogSource?: "provider" | "preview";
  readonly documentTypes: readonly { readonly code: string; readonly name: string; readonly hasBack: boolean }[];
  readonly enhancedDocumentTypes: readonly { readonly code: string; readonly name: string; readonly hasBack: boolean }[];
  readonly idNumberTypes: readonly { readonly country: string; readonly type: string; readonly label: string; readonly regex: string; readonly requiredFields?: readonly string[]; readonly bankCode?: string }[];
  readonly availability: { readonly documentVerification: boolean; readonly enhancedDocumentVerification: boolean; readonly idNumberVerification: boolean };
  readonly enhancedDocumentEntitlementStatus?: "not_configured" | "available" | "unavailable";
}

export interface IdentityDocumentCountries {
  readonly countries: readonly { readonly code: string; readonly name: string }[];
  readonly catalogSource?: "provider" | "preview";
  readonly availability: { readonly documentVerification: boolean; readonly enhancedDocumentVerification: boolean; readonly idNumberVerification: boolean };
}

export interface IdentityCaptureChoice {
  readonly verificationMethod: "document" | "id_number";
  readonly verificationProduct: "document_verification" | "enhanced_document_verification" | "enhanced_kyc";
  readonly documentCountry: string;
  readonly documentType: string;
}

export interface IdentityCaptureSession {
  readonly mode: "hosted_link" | "web_integration";
  readonly url?: string;
  readonly token?: string;
  readonly product: string;
  readonly caseId: string;
  readonly captureAttemptId: string;
}
