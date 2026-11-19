import type { IdentityCaseStatus, IdentityCheckResult } from "@/types/identityVerification.type";

export const identityCaseStatusTabs: readonly { readonly key: IdentityCaseStatus; readonly label: string }[] = [
  { key: "under_review", label: "Needs review" },
  { key: "awaiting_capture", label: "Waiting for identity check" },
  { key: "awaiting_consent", label: "Paid, not started" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

export const verificationViewTabs = [
  { href: "/verification", label: "Verification requests" },
  { href: "/verification/identity", label: "Identity checks" },
  { href: "/verification/business-documents", label: "Business documents" },
  { href: "/verification/black", label: "Black applications" },
] as const;

export const identityCheckTone: Record<IdentityCheckResult, "success" | "danger" | "caution" | "neutral"> = {
  passed: "success", matched: "success", failed: "danger", review: "caution", not_done: "neutral", pending: "neutral",
};

export const identityReasonCopy: Record<string, string> = {
  liveness_not_passed: "Selfie liveness did not pass",
  document_not_valid: "The ID document did not pass checks",
  face_match_not_passed: "Selfie does not clearly match the ID photo",
  government_lookup_not_matched: "Government database lookup did not match",
  name_does_not_match_profile: "Name on the ID does not match the profile",
  trust_score_below_threshold: "Trust score below the auto-approve threshold",
  not_eligible_when_paid: "Paid in the app before qualifying",
  document_used_by_another_account: "The same ID is on another account",
  business_documents_not_approved: "Business documents not approved yet",
  spoof_attempt: "Possible spoof attempt",
  id_reused_across_accounts: "ID reused across accounts",
  id_name_mismatch: "ID belongs to a different name",
  id_number_not_found: "ID number not found in the government database",
  provider_result_requires_review: "Smile ID returned a result reason that needs review",
  provider_result_reason_unrecognized: "Smile ID returned an unrecognized result reason",
  provider_identity_type_mismatch: "Smile ID's returned country or ID type differs from the selected verification choice",
  provider_risk_requires_review: "Smile ID flagged this verification for additional risk review",
  smile_reason_document_expired: "Smile ID: document expired",
  smile_reason_age_requirement_not_met: "Smile ID: minimum age requirement not met",
  smile_reason_document_copy_detected: "Smile ID: document copy detected",
  smile_reason_medium_risk: "Smile ID: medium risk result",
  smile_reason_high_risk: "Smile ID: high risk result",
  smile_reason_account_locked_fraud: "Smile ID: account locked for fraud",
  smile_reason_face_verification_failed: "Smile ID: face verification failed",
  smile_reason_spoof_detected: "Smile ID: possible spoof detected",
  smile_reason_document_check_failed: "Smile ID: document check failed",
  smile_reason_unsupported_document: "Smile ID: unsupported document",
  smile_reason_identifier_not_found: "Smile ID: identifier not found",
  smile_reason_image_unavailable_or_invalid: "Smile ID: image unavailable or invalid",
  smile_reason_service_unavailable: "Smile ID: verification service temporarily unavailable",
  smile_reason_internal_error: "Smile ID: internal processing error",
  smile_reason_invalid_id_number: "Smile ID: invalid ID number",
  smile_reason_document_unclassifiable: "Smile ID: document could not be classified",
  smile_reason_content_policy_violated: "Smile ID: submitted content could not be processed",
};

export const refundStatusCopy: Record<string, string> = {
  not_applicable: "No refund (plan continues)",
  requested: "Refund in progress",
  refunded: "Refunded",
  not_charged: "Nothing was charged",
  failed: "Refund failed: refund by hand",
  manual_store_refund: "User must request the refund from Apple",
};
