import type { IdentityCaseStatus, IdentityCheckResult } from "@/types/identityVerification.type";

export const identityCaseStatusTabs: readonly { readonly key: IdentityCaseStatus; readonly label: string }[] = [
  { key: "under_review", label: "Needs review" },
  { key: "awaiting_capture", label: "Waiting for selfie and ID" },
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
};

export const refundStatusCopy: Record<string, string> = {
  not_applicable: "No refund (plan continues)",
  requested: "Refund in progress",
  refunded: "Refunded",
  not_charged: "Nothing was charged",
  failed: "Refund failed: refund by hand",
  manual_store_refund: "User must request the refund from Apple",
};
