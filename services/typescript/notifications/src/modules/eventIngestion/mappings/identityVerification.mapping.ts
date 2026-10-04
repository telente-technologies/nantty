import type { EventDataReader } from "../../../utils/eventDataReader.util.js";
import { intentFor, plan, type EventMapping, type MappingContext } from "./mappingHelpers.js";

type RefundMethod = "card" | "google_play" | "apple_request" | "plan_continues";

const checkmarkOf = (data: EventDataReader): "Blue" | "Gold" => (data.text("checkmark").toLowerCase() === "gold" ? "Gold" : "Blue");
const markProps = (data: EventDataReader, firstName: string) => ({ firstName, checkmark: checkmarkOf(data), accountName: data.text("accountName") });
const refundMethodOf = (data: EventDataReader): RefundMethod => {
  const method = data.text("refundMethod", "card");
  return method === "google_play" || method === "apple_request" || method === "plan_continues" ? method : "card";
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
export const verificationRejectedRefunded = verificationMapping("We couldn't verify your account",
  (data) => (refundMethodOf(data) === "apple_request" ? "Your subscription is cancelled. Open the email to request your refund from Apple." : refundMethodOf(data) === "plan_continues" ? "Open the email to see why and when you can try again." : "Your payment is being refunded. Open the email to see why."),
  (data, firstName) => plan("verificationRejectedRefunded", { ...markProps(data, firstName), reasons: data.textList("reasons"), refundMethod: refundMethodOf(data), reapplyFrom: data.text("reapplyFrom") }));
