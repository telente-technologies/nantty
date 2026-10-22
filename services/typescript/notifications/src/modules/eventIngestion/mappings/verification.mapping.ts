import type { EventDataReader } from "../../../utils/eventDataReader.util.js";
import { intentFor, plan, type EventMapping, type IntentParts } from "./mappingHelpers.js";

const checkmarkOf = (data: EventDataReader): "Blue" | "Gold" | "Black" => ((value) => (value === "gold" ? "Gold" : value === "black" ? "Black" : "Blue"))(data.text("checkmark").toLowerCase());
const markProps = (data: EventDataReader, firstName: string) => ({ firstName, checkmark: checkmarkOf(data), accountName: data.text("accountName") });

function checkmarkMapping(title: string, body: string, email: (data: EventDataReader, firstName: string) => ReturnType<typeof plan>, userKey = "accountId"): EventMapping {
  return (event, data) => [intentFor(event, data.text(userKey), { category: "checkmarks", inApp: { category: "system", title, body }, push: { title, body }, email: (recipient) => email(data, recipient.firstName) })];
}

export const checkmarkSuggested = checkmarkMapping("You may be eligible for a checkmark", "Review your options in verification settings.",
  (data, firstName) => plan("checkmarkSuggestion", { ...markProps(data, firstName), price: data.money("price"), reasons: data.textList("reasons") }));
export const checkmarkApplicationSubmitted = checkmarkMapping("Checkmark application received", "We will review it and let you know.",
  (data, firstName) => plan("checkmarkApplicationReceived", { ...markProps(data, firstName), applicationId: data.text("applicationId"), reviewWithinDays: data.integer("reviewWithinDays", 3) }));
export const checkmarkApproved = checkmarkMapping("Your checkmark was approved", "Your checkmark is now on your profile.",
  (data, firstName) => plan("checkmarkApproved", { ...markProps(data, firstName), renewsAt: data.text("renewsAt") }));
export const checkmarkRejected = checkmarkMapping("Your checkmark was not approved", "Open the email for the reasons and when you can reapply.",
  (data, firstName) => plan("checkmarkRejected", { ...markProps(data, firstName), reasons: data.textList("reasons"), reapplyFrom: data.text("reapplyFrom") }));
export const checkmarkRevoked: EventMapping = (event, data, context) => [
  intentFor(event, data.text("accountId"), {
    category: "checkmarks",
    inApp: { category: "system", title: "Your checkmark was removed", body: "Review the reason and appeal options in verification settings.", data: { url: `${context.webBaseUrl}/settings/verification`, screen: "Verification" } },
    push: { title: "Your checkmark was removed", body: "Review the reason and appeal options in verification settings." },
    email: (recipient) => plan("checkmarkRevoked", { ...markProps(data, recipient.firstName), reason: data.text("reason"), appealUrl: data.text("appealUrl") }),
  }),
];
export const checkmarkRenewalFailed = checkmarkMapping("Checkmark renewal payment failed", "Update your payment method before the grace period ends.",
  (data, firstName) => plan("checkmarkRenewalDue", { ...markProps(data, firstName), price: data.money("price"), failedAt: data.text("failedAt"), graceEndsAt: data.text("graceEndsAt") }));

const creatorMapping = (title: string, body: string, email: (data: EventDataReader, firstName: string) => ReturnType<typeof plan>): EventMapping => (event, data) =>
  [intentFor(event, data.text("accountId"), { category: "creator", inApp: { category: "system", title, body }, push: { title, body }, email: (recipient) => email(data, recipient.firstName) })];

export const creatorApplicationSubmitted = creatorMapping("Creator application received", "We will decide within a few days.",
  (data, firstName) => plan("creatorApplicationReceived", { firstName, applicationId: data.text("applicationId"), decisionWithinDays: data.integer("decisionWithinDays", 3) }));
export const creatorApplicationApproved = creatorMapping("You are in the Creator Program", "Your Studio is ready.",
  (data, firstName) => plan("creatorApproved", { firstName, handle: data.text("handle") }));
export const creatorApplicationNeedsReview = creatorMapping("Your creator application is in review", "A person is taking a closer look.",
  (data, firstName) => plan("creatorNeedsReview", { firstName, applicationId: data.text("applicationId"), reviewWithinDays: data.integer("reviewWithinDays", 5) }));
export const creatorApplicationIneligible = creatorMapping("Not eligible for the Creator Program yet", "See your progress and when to reapply.",
  (data, firstName) => plan("creatorNotEligibleYet", {
    firstName,
    requirements: data.objectList("requirements").map((entry) => ({ label: entry.text("label"), value: entry.integer("value"), target: entry.integer("target"), ...(entry.optionalText("display") === undefined ? {} : { display: entry.text("display") }) })),
    ...(data.optionalText("reapplyFrom") === undefined ? {} : { reapplyFrom: data.text("reapplyFrom") }),
  }));

const documentsProps = (data: EventDataReader, firstName: string) => ({ firstName, storeName: data.text("storeName"), documents: data.textList("documents") });
const sellerMapping = (title: string, body: string, email: (data: EventDataReader, firstName: string) => ReturnType<typeof plan>, category: IntentParts["category"] = "seller"): EventMapping => (event, data) =>
  [intentFor(event, data.text("accountId"), { category, inApp: { category: "system", title, body }, push: { title, body }, email: (recipient) => email(data, recipient.firstName) })];

export const sellerDocumentsSubmitted = sellerMapping("Business documents received", "We will review them shortly.", (data, firstName) => plan("documentsReceived", { ...documentsProps(data, firstName), reviewWithinDays: data.integer("reviewWithinDays", 3) }));
export const sellerDocumentsApproved = sellerMapping("Business documents approved", "Your store can now sell.", (data, firstName) => plan("documentsApproved", documentsProps(data, firstName)));
export const sellerDocumentsRejected = sellerMapping("Business documents need changes", "Open the email to see what to fix.", (data, firstName) => plan("documentsRejected", { ...documentsProps(data, firstName), issues: data.textList("issues") }));

const planOf = (data: EventDataReader): "Pro" | "Business" | "Gold" => ((value) => (value === "business" ? "Business" : value === "gold" ? "Gold" : "Pro"))(data.text("plan").toLowerCase());
const planProps = (data: EventDataReader, firstName: string) => ({
  firstName, storeName: data.text("storeName"), plan: planOf(data), price: data.money("price"), interval: data.text("interval", "month") === "year" ? ("year" as const) : ("month" as const),
});

export const planTrialStarted = sellerMapping("Your plan trial started", "Enjoy your trial.", (data, firstName) => plan("planTrialStarted", { ...planProps(data, firstName), trialEndsAt: data.text("trialEndsAt"), cardLabel: data.text("cardLabel"), verificationCharge: data.money("verificationCharge") }));
export const planTrialEnding = sellerMapping("Your trial is ending soon", "Your plan renews when the trial ends.", (data, firstName) => plan("planTrialEnding", { ...planProps(data, firstName), daysLeft: data.integer("daysLeft") === 1 ? 1 : 3, trialEndsAt: data.text("trialEndsAt"), cardLabel: data.text("cardLabel") }));
export const planTrialConverted = sellerMapping("Your plan is now active", "Your first invoice was paid.", (data, firstName) => plan("planTrialConverted", { ...planProps(data, firstName), nextBillingAt: data.text("nextBillingAt"), invoiceNumber: data.text("invoiceNumber") }));
export const planInvoicePaymentFailed = sellerMapping("Plan payment failed", "Update your card to keep your plan.", (data, firstName) => plan("planPaymentFailed", { ...planProps(data, firstName), cardLabel: data.text("cardLabel"), reason: data.text("reason"), retryAt: data.text("retryAt"), downgradeAt: data.text("downgradeAt") }));
export const planInvoicePaid = sellerMapping("Plan receipt", "Your invoice was paid.", (data, firstName) => plan("planReceipt", {
  ...planProps(data, firstName), invoiceNumber: data.text("invoiceNumber"), paidAt: data.text("paidAt"), periodStart: data.text("periodStart"), periodEnd: data.text("periodEnd"), cardLabel: data.text("cardLabel"), vat: data.money("vat"),
  ...(data.optionalMoney("discount") === undefined ? {} : { discount: data.money("discount") }),
}), "payments");
export const cardVerificationRefunded = sellerMapping("Card verification refunded", "The small verification charge was returned.", (data, firstName) => plan("cardVerificationRefunded", {
  firstName, amount: data.money("amount"), cardLabel: data.text("cardLabel"), reason: data.text("reason", "Card verification for your trial"), reference: data.text("reference"),
}), "payments");
