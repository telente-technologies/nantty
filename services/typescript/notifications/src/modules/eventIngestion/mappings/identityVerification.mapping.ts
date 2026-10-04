import type { EventDataReader } from "../../../utils/eventDataReader.util.js";
import { intentFor, plan, type EventMapping, type MappingContext } from "./mappingHelpers.js";

type RefundMethod = "card" | "google_play" | "apple_request" | "plan_continues" | "plan_share_card" | "plan_share_store";

const refundMethods: readonly string[] = ["google_play", "apple_request", "plan_continues", "plan_share_card", "plan_share_store"];

const checkmarkOf = (data: EventDataReader): "Blue" | "Gold" => (data.text("checkmark").toLowerCase() === "gold" ? "Gold" : "Blue");
const markProps = (data: EventDataReader, firstName: string) => ({ firstName, checkmark: checkmarkOf(data), accountName: data.text("accountName") });
const refundMethodOf = (data: EventDataReader): RefundMethod => {
  const method = data.text("refundMethod", "card");
  return refundMethods.includes(method) ? (method as RefundMethod) : "card";
};
const hubLink = (context: MappingContext, data: EventDataReader) => data.text("deepLink", `${context.webBaseUrl}/settings/verification`);

function verificationMapping(title: string, body: (data: EventDataReader) => string, email: (data: EventDataReader, firstName: string, context: MappingContext) => ReturnType<typeof plan>): EventMapping {
  return (event, data, context) => {
    const link = { url: hubLink(context, data), screen: "Verification", caseId: data.text("caseId", "") };
    return [intentFor(event, data.text("accountId"), {
      category: "checkmarks",
      inApp: { category: "system", title, body: body(data), data: link },
      push: { title, body: body(data), data: link },
      email: (recipient) => email(data, recipient.firstName, context),
    })];
  };
}

export const verificationEligible = verificationMapping("You can now apply for verification", (data) => `Your account qualifies for the ${checkmarkOf(data)} checkmark. Tap to apply.`,
  (data, firstName, context) => plan("verificationEligible", { ...markProps(data, firstName), payUrl: hubLink(context, data) }));
export const verificationUnderReview = verificationMapping("Your verification is being reviewed", () => "A person will check it within a few days. No action needed.",
  (data, firstName) => plan("verificationUnderReview", { ...markProps(data, firstName), caseId: data.text("caseId"), reviewWithinDays: data.integer("reviewWithinDays", 3) }));
export const verificationApproved = verificationMapping("You're verified", (data) => `Your ${checkmarkOf(data)} checkmark is now on your profile.`,
  (data, firstName) => plan("verificationApproved", { ...markProps(data, firstName), verifiedAt: data.text("verifiedAt") }));
const rejectionBody = (data: EventDataReader): string => {
  const method = refundMethodOf(data);
  const amount = data.optionalMoney("refundAmount");
  const share = amount ? `${new Intl.NumberFormat("en", { style: "currency", currency: amount.currency }).format(amount.amountMinor / 100)} for the checkmark` : "the checkmark's share";
  if (method === "plan_share_card") return `Your plan stays active; we've refunded ${share}. Open the email to see why.`;
  if (method === "plan_share_store") return `Your plan stays active; we're arranging ${share} with the store. Open the email for the steps.`;
  if (method === "apple_request") return "Your subscription is cancelled. Open the email to request your refund from Apple.";
  if (method === "plan_continues") return "Open the email to see why and when you can try again.";
  return "Your payment is being refunded. Open the email to see why.";
};

export const verificationRejectedRefunded = verificationMapping("We couldn't verify your account", rejectionBody,
  (data, firstName) => plan("verificationRejectedRefunded", { ...markProps(data, firstName), reasons: data.textList("reasons"), refundMethod: refundMethodOf(data), refundAmount: data.optionalMoney("refundAmount"), reapplyFrom: data.text("reapplyFrom") }));
