const reasonCopy: Record<string, string> = {
  account_age_below_threshold: "Your account needs to be a little older.",
  real_followers_below_threshold: "Grow your real, active followers.",
  low_recent_activity: "Post original content regularly.",
  recent_violation: "Go a while without any strikes on your account.",
  high_fraud_score: "Some recent activity on your account needs to settle down.",
  completed_orders_below_threshold: "Complete more orders in your store.",
  success_rate_below_threshold: "Keep your order success rate high.",
  no_active_store_or_brand_page: "Set up an active store or brand page.",
  borderline_content: "Keep your posts within our community guidelines.",
};

export function describeEligibilityReason(code: string): string | null {
  return reasonCopy[code] ?? null;
}

export function describeDocumentType(code: string): string {
  const labels: Record<string, string> = {
    NIN_SLIP: "NIN slip", IDENTITY_CARD: "National ID card (NIN)", PASSPORT: "International passport", DRIVERS_LICENSE: "Driver's licence", VOTER_ID: "Voter's card",
    GHANA_CARD: "Ghana Card", NATIONAL_ID: "National ID", ALIEN_CARD: "Alien card", GREEN_BOOK: "Green ID book",
  };
  return labels[code] ?? code.replaceAll("_", " ").toLowerCase();
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
  "Our verification partner Smile ID will capture a short selfie video to check you're a real person, and a photo of your government ID.",
  "Smile ID compares your face with the photo on your ID and, where available, checks your ID number with the government database (for example NIN).",
  "Zudomart keeps only the result, your ID type, country and the verification date. We never store your face data or keep your selfie or ID images.",
  "Biometric data is sensitive personal data under the Nigeria Data Protection Act. You can withdraw consent before the check by closing this screen.",
];
