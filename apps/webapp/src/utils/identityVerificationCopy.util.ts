import type { IdentityCaptureChoice, IdentityDocumentTypes } from "@/types/identityVerification.type";

const reasonCopy: Record<string, string> = {
  account_age_below_threshold: "Your account needs to be a little older.",
  real_followers_below_threshold: "Grow your real, active followers.",
  low_recent_activity: "Post original content regularly.",
  recent_violation: "Go a while without any strikes on your account.",
  email_not_verified: "Verify your email address.",
  high_fraud_score: "Some recent activity on your account needs to settle down.",
  completed_orders_below_threshold: "Complete more orders in your store.",
  success_rate_below_threshold: "Keep your order success rate high.",
  no_active_store_or_brand_page: "Set up an active store or brand page.",
  borderline_content: "Keep your posts within our community guidelines.",
};

export interface IdentityVerificationMethodOption {
  readonly verificationMethod: IdentityCaptureChoice["verificationMethod"];
  readonly verificationProduct: IdentityCaptureChoice["verificationProduct"];
  readonly types: readonly { readonly code: string; readonly name: string }[];
}

function isPersonalIdentityNumberType(item: IdentityDocumentTypes["idNumberTypes"][number]): boolean {
  return !item.bankCode?.trim() && item.type.trim().toUpperCase() !== "BANK_ACCOUNT" &&
    !item.requiredFields?.some((field) => field.trim().toLowerCase() === "bank_code");
}

export function availableIdentityVerificationMethods(catalog: IdentityDocumentTypes | undefined): IdentityVerificationMethodOption[] {
  if (!catalog) return [];
  const options: IdentityVerificationMethodOption[] = [];
  if (catalog.availability.documentVerification && catalog.documentTypes.length > 0) {
    options.push({ verificationMethod: "document", verificationProduct: "document_verification", types: catalog.documentTypes });
  }
  if (catalog.enhancedDocumentEntitlementStatus === "available" && catalog.availability.enhancedDocumentVerification && catalog.enhancedDocumentTypes.length > 0) {
    options.push({ verificationMethod: "document", verificationProduct: "enhanced_document_verification", types: catalog.enhancedDocumentTypes });
  }
  if (catalog.availability.idNumberVerification && catalog.idNumberTypes.length > 0) {
    const matchingCountryTypes = catalog.idNumberTypes
      .filter((item) => item.country.trim().toUpperCase() === catalog.country.trim().toUpperCase() && isPersonalIdentityNumberType(item));
    if (matchingCountryTypes.length > 0) {
      options.push({ verificationMethod: "id_number", verificationProduct: "enhanced_kyc", types: matchingCountryTypes.map(({ type, label }) => ({ code: type, name: label })) });
    }
  }
  return options;
}

export function describeEligibilityReason(code: string): string | null {
  return reasonCopy[code] ?? null;
}

export function describeDocumentType(code: string, providerLabel?: string): string {
  const labels: Record<string, string> = {
    NIN: "National Identification Number", NIN_V2: "National ID number (NIN, 11 digits)", NIN_SLIP: "NIN slip (11-digit number)", V_NIN: "Virtual NIN (16-character code)", BVN: "Bank Verification Number (BVN)",
    IDENTITY_CARD: "Identity card", PASSPORT: "Passport", DRIVERS_LICENSE: "Driver's licence", VOTER_ID: "Voter's ID", ALIEN_CARD: "Resident / alien ID",
  };
  return labels[code] ?? providerLabel?.trim() ?? code.replaceAll("_", " ").toLowerCase();
}

export function sortIdentityCountries<T extends { readonly code: string; readonly name: string }>(countries: readonly T[]): T[] {
  return [...countries].sort((left, right) => left.name.localeCompare(right.name) || left.code.localeCompare(right.code));
}

export function filterIdentityCountries<T extends { readonly code: string; readonly name: string }>(countries: readonly T[], search: string): T[] {
  const query = search.trim().toLowerCase();
  if (!query) return [...countries];
  return countries.filter(({ code, name }) => `${name} ${code}`.toLowerCase().includes(query));
}

function describeCheckmarkShareRefund(refundStatus: string): string {
  if (refundStatus === "refunded") return "Your plan stays active. We've refunded the checkmark's share to your card; banks usually show it within 5 to 10 working days.";
  if (refundStatus === "manual_store_refund") return "Your plan stays active. We're arranging the checkmark's share of your payment with the store; request it from Apple at reportaproblem.apple.com if you paid there.";
  if (refundStatus === "not_charged") return "Your plan stays active. Only the checkmark wasn't added, and you weren't charged for it.";
  return "Your plan stays active. We're refunding the checkmark's share of your payment.";
}

export function describeRefund(refundMethod: string, refundStatus: string, refundScope = "full"): string {
  if (refundScope === "checkmark_share") return describeCheckmarkShareRefund(refundStatus);
  if (refundMethod === "plan_continues") return "Your plan keeps working. Only the checkmark wasn't added, so there is nothing to refund.";
  if (refundStatus === "refunded") return "Your payment has been refunded in full.";
  if (refundStatus === "manual_store_refund" || refundMethod === "apple_request") return "Your subscription is cancelled. Apple handles App Store refunds: request yours at reportaproblem.apple.com.";
  if (refundMethod === "google_play") return "Google Play is refunding your payment in full.";
  return "We're refunding your payment in full. Banks usually show it within 5 to 10 working days.";
}

export const biometricConsentPoints: readonly string[] = [
  "Our verification partner Smile ID will use the method you choose: a selfie and photo ID, or an eligible country-specific ID-number check.",
  "Your ID number is entered on Smile ID's secure hosted page when required; do not send it to Nantty in chat or support messages.",
  "Nantty keeps the result, ID type, country, verification date and a one-way fingerprint to prevent the same ID being reused across accounts. We do not store your ID number, face data, selfie or ID images.",
  "If you choose a selfie check, biometric information is sensitive personal data. You can decline before starting. After submitting, contact Nantty Support to ask about withdrawing consent or deleting eligible data.",
];
