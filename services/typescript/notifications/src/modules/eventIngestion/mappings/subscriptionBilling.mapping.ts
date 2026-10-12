import type { EventDataReader } from "../../../utils/eventDataReader.util.js";
import { intentFor, plan, type EventMapping, type MappingContext } from "./mappingHelpers.js";

type LineItemKind = "plan_base" | "checkmark" | "bundle_discount" | "offer_discount" | "proration_credit";
const lineItemKinds: readonly LineItemKind[] = ["plan_base", "checkmark", "bundle_discount", "offer_discount", "proration_credit"];

function billingUrls(data: EventDataReader, context: MappingContext) {
  const manage = data.text("audience", "personal") === "business" ? `${context.sellerDashboardUrl}/settings/billing` : `${context.webBaseUrl}/settings/subscriptions`;
  const subscription = encodeURIComponent(data.text("subscriptionId", ""));
  return { manageUrl: manage, cancelUrl: `${manage}/cancel?subscription=${subscription}`, payUrl: `${manage}/pay?subscription=${subscription}`, updateCardUrl: `${manage}/payment-method?subscription=${subscription}` };
}

function subscriberProps(data: EventDataReader, context: MappingContext, firstName: string) {
  return {
    firstName, planLabel: data.text("planLabel", "your plan"), accountName: data.text("accountName", data.text("storeName", "your account")),
    interval: data.text("interval", "month") === "year" ? ("year" as const) : ("month" as const), manageUrl: billingUrls(data, context).manageUrl,
  };
}

function lineItems(data: EventDataReader, currency: string) {
  return data.objectList("lineItems").map((entry) => {
    const kind = entry.text("kind", "plan_base") as LineItemKind;
    return { kind: lineItemKinds.includes(kind) ? kind : ("plan_base" as const), label: entry.text("label", "Plan"), amount: { amountMinor: entry.integer("amountMinor", 0), currency } };
  });
}

function billingMapping(title: string, body: string, email: (data: EventDataReader, context: MappingContext, firstName: string) => ReturnType<typeof plan>): EventMapping {
  return (event, data, context) => [intentFor(event, data.text("accountId"), { category: "payments", inApp: { category: "system", title, body }, push: { title, body }, email: (recipient) => email(data, context, recipient.firstName) })];
}

export const subscriptionTrialEnding = billingMapping("Your free trial is ending", "Open billing to keep or cancel your plan.", (data, context, firstName) => {
  const amount = data.money("amount");
  return plan("subscriptionTrialEnding", {
    ...subscriberProps(data, context, firstName), daysLeft: data.integer("daysLeft", 3) === 1 ? 1 : 3, trialEndsAt: data.text("trialEndsAt", data.text("chargeAt", "")), amount,
    lineItems: lineItems(data, amount.currency), cardLabel: data.text("cardLabel", "your saved card"), cancelUrl: billingUrls(data, context).cancelUrl,
  });
});

export const subscriptionRenewalUpcoming = billingMapping("Your plan renews in 7 days", "Review the amount or cancel before it renews.", (data, context, firstName) => {
  const amount = data.money("amount");
  return plan("subscriptionRenewalUpcoming", {
    ...subscriberProps(data, context, firstName), chargeAt: data.text("chargeAt"), amount, lineItems: lineItems(data, amount.currency),
    cardLabel: data.text("cardLabel", "your saved card"), cancelUrl: billingUrls(data, context).cancelUrl,
  });
});

export const subscriptionInvoicePaid = billingMapping("Plan payment received", "Your receipt is in your email.", (data, context, firstName) => {
  const total = data.money("total");
  return plan("subscriptionRenewalReceipt", {
    ...subscriberProps(data, context, firstName), invoiceNumber: data.text("invoiceNumber"), paidAt: data.text("paidAt"), periodStart: data.text("periodStart"), periodEnd: data.text("periodEnd"),
    lineItems: lineItems(data, total.currency), total, cardLabel: data.text("cardLabel", "your saved card"), firstCharge: data.text("kind", "renewal") !== "renewal",
  });
});

export const subscriptionPaymentFailed = billingMapping("Plan payment failed", "Pay now or update your card to keep your plan.", (data, context, firstName) =>
  plan("subscriptionPaymentFailed", {
    ...subscriberProps(data, context, firstName), attempt: data.integer("attempt", 1), downgradeAt: data.text("downgradeAt"), reason: data.text("reason", "The payment was declined."),
    amount: data.money("amount"), cardLabel: data.text("cardLabel", "your saved card"), payUrl: data.optionalText("actionUrl") ?? billingUrls(data, context).payUrl, trialConversion: data.bool("trialConversion"),
    ...(data.optionalText("retryAt") === undefined ? {} : { retryAt: data.text("retryAt") }),
    ...(data.optionalText("graceEndsAt") === undefined ? {} : { graceEndsAt: data.text("graceEndsAt") }),
  }));

export const subscriptionGraceEnding = billingMapping("Your plan ends in 2 days", "Pay now to keep your plan.", (data, context, firstName) =>
  plan("subscriptionGraceEnding", { ...subscriberProps(data, context, firstName), graceEndsAt: data.text("graceEndsAt"), amount: data.money("amount"), payUrl: billingUrls(data, context).payUrl }));

export const subscriptionDowngraded = billingMapping("You're on the Free plan", "We couldn't collect your plan payment.", (data, context, firstName) =>
  plan("subscriptionDowngraded", { ...subscriberProps(data, context, firstName), checkmarkRemoved: data.bool("checkmarkRemoved"), trialEnded: data.text("reason", "") === "trial_payment_failed" }));

export const subscriptionCardExpiring = billingMapping("Your card expires soon", "Update it before your next renewal.", (data, context, firstName) =>
  plan("subscriptionCardExpiring", {
    ...subscriberProps(data, context, firstName), cardLabel: data.text("cardLabel", "your saved card"), expiryMonth: data.integer("expiryMonth"), expiryYear: data.integer("expiryYear"),
    chargeAt: data.text("chargeAt"), updateCardUrl: billingUrls(data, context).updateCardUrl,
  }));

export const subscriptionPriceChange = billingMapping("Your plan price is changing", "Open the email to see the new price and date.", (data, context, firstName) =>
  plan("subscriptionPriceChange", { ...subscriberProps(data, context, firstName), oldPrice: data.money("oldPrice"), newPrice: data.money("newPrice"), effectiveAt: data.text("effectiveAt"), cancelUrl: billingUrls(data, context).cancelUrl }));
