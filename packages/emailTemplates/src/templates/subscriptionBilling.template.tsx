import type { EmailBlock, Money } from "../emailTypes";
import { ngn } from "../samples/sampleData";
import { consentRules, defineEmailTemplate } from "./defineTemplate";

const base = { category: "payments", kind: "transactional", audience: "Plan subscriber (web card billing)", consent: consentRules.always } as const;

export interface BillingLineItem {
  readonly kind: "plan_base" | "checkmark" | "bundle_discount" | "offer_discount" | "proration_credit";
  readonly label: string;
  readonly amount: Money;
}

interface SubscriberProps {
  readonly firstName: string;
  readonly planLabel: string;
  readonly accountName: string;
  readonly interval: "month" | "year";
  readonly manageUrl: string;
}

const sampleSubscriber: SubscriberProps = { firstName: "Tobi", planLabel: "Pro plan", accountName: "Adire Lagos Studio", interval: "month", manageUrl: "https://dashboard.zudomart.com/settings/billing" };
const sampleItems: readonly BillingLineItem[] = [{ kind: "plan_base", label: "Pro plan", amount: ngn(2000) }, { kind: "checkmark", label: "Gold checkmark", amount: ngn(3000) }];
const intervalWord = (interval: "month" | "year") => (interval === "year" ? "yearly" : "monthly");

export function lineItemsBlock(items: readonly BillingLineItem[], total: Money, totalLabel: string): EmailBlock {
  return {
    type: "totals",
    rows: items.map((item) => (item.amount.amountMinor < 0 ? { label: item.label, amount: { ...item.amount, amountMinor: -item.amount.amountMinor }, credit: true } : { label: item.label, amount: item.amount })),
    total: { label: totalLabel, amount: total },
  };
}

const checkmarkNote = (items: readonly BillingLineItem[]): EmailBlock[] =>
  items.some((item) => item.kind === "checkmark") && items.some((item) => item.kind === "plan_base")
    ? [{ type: "paragraph", muted: true, text: "The checkmark line shows the part of your plan price that covers the checkmark. It's part of the plan, so it's charged even while your verification is in review." }]
    : [];

export const subscriptionTrialEnding = defineEmailTemplate<SubscriberProps & { readonly daysLeft: 3 | 1; readonly trialEndsAt: string; readonly amount: Money; readonly lineItems: readonly BillingLineItem[]; readonly cardLabel: string; readonly cancelUrl: string }>({
  ...base, key: "subscriptionTrialEnding", name: "Free trial ending (3 days / 24 hours)", trigger: "subscriptionTrial.ending (T-3d, T-24h)",
  subject: (p) => (p.daysLeft === 1 ? `Your ${p.planLabel} trial ends tomorrow` : `3 days left in your ${p.planLabel} trial`),
  preheader: (p, c) => `We'll charge ${c.money(p.amount)} to ${p.cardLabel} on ${c.date(p.trialEndsAt)} unless you cancel.`,
  blocks: (p, c) => [
    { type: "hero", eyebrow: p.daysLeft === 1 ? "Ends in 24 hours" : "3 days left", title: `Your free trial ends ${c.dateTime(p.trialEndsAt)}`, tone: "warn" },
    { type: "paragraph", text: [`Hi ${p.firstName}, to keep ${p.planLabel} for ${p.accountName}, do nothing. On `, { strong: c.dateTime(p.trialEndsAt) }, " we'll charge ", { strong: c.money(p.amount) }, ` to ${p.cardLabel}, then ${intervalWord(p.interval)} until you cancel.`] },
    lineItemsBlock(p.lineItems, p.amount, "First charge"),
    ...checkmarkNote(p.lineItems),
    { type: "button", label: "Keep my plan", href: p.manageUrl },
    { type: "links", items: [{ label: "Cancel the trial — you won't be charged", href: p.cancelUrl }] },
  ],
  sample: { ...sampleSubscriber, daysLeft: 3, trialEndsAt: "2026-10-11T09:00:00.000Z", amount: ngn(5000), lineItems: sampleItems, cardLabel: "Mastercard •••• 5521", cancelUrl: "https://dashboard.zudomart.com/settings/billing/cancel" },
});

export const subscriptionRenewalUpcoming = defineEmailTemplate<SubscriberProps & { readonly chargeAt: string; readonly amount: Money; readonly lineItems: readonly BillingLineItem[]; readonly cardLabel: string; readonly cancelUrl: string }>({
  ...base, key: "subscriptionRenewalUpcoming", name: "Yearly renewal coming up (7 days)", trigger: "subscriptionRenewal.upcoming (T-7d, yearly plans)",
  subject: (p, c) => `${p.planLabel} renews on ${c.date(p.chargeAt)}`,
  preheader: (p, c) => `${c.money(p.amount)} will be charged to ${p.cardLabel}. Cancel any time before then.`,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Yearly renewal", title: `Your plan renews in 7 days`, tone: "brand" },
    { type: "paragraph", text: [`Hi ${p.firstName}, ${p.accountName}'s ${p.planLabel} renews for another year on `, { strong: c.date(p.chargeAt) }, `. We'll charge ${p.cardLabel}.`] },
    lineItemsBlock(p.lineItems, p.amount, "Renewal total"),
    ...checkmarkNote(p.lineItems),
    { type: "button", label: "Review my plan", href: p.manageUrl },
    { type: "links", items: [{ label: "Cancel renewal", href: p.cancelUrl }] },
    { type: "paragraph", muted: true, text: "If you cancel, you keep everything until the end of the year you've paid for. We don't give partial refunds." },
  ],
  sample: { ...sampleSubscriber, interval: "year", chargeAt: "2027-10-04T09:00:00.000Z", amount: ngn(48000), lineItems: [{ kind: "plan_base", label: "Pro plan", amount: ngn(19000) }, { kind: "checkmark", label: "Gold checkmark", amount: ngn(29000) }], cardLabel: "Visa •••• 4081", cancelUrl: "https://dashboard.zudomart.com/settings/billing/cancel" },
});

export const subscriptionRenewalReceipt = defineEmailTemplate<SubscriberProps & { readonly invoiceNumber: string; readonly paidAt: string; readonly periodStart: string; readonly periodEnd: string; readonly lineItems: readonly BillingLineItem[]; readonly total: Money; readonly cardLabel: string; readonly firstCharge: boolean }>({
  ...base, key: "subscriptionRenewalReceipt", name: "Plan receipt with line items", trigger: "subscriptionInvoice.paid",
  subject: (p, c) => (p.firstCharge ? `Welcome to ${p.planLabel} — receipt for ${c.money(p.total)}` : `Receipt: ${p.planLabel} renewed (${c.money(p.total)})`),
  preheader: (p, c) => `Paid ${c.date(p.paidAt)}. Next renewal ${c.date(p.periodEnd)}.`,
  reference: (p) => p.invoiceNumber,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Receipt", title: p.firstCharge ? `${p.accountName} is on ${p.planLabel}` : "Thanks — your plan is renewed", tone: "success" },
    lineItemsBlock(p.lineItems, p.total, "Total paid"),
    ...checkmarkNote(p.lineItems),
    { type: "details", rows: [{ label: "Invoice", value: p.invoiceNumber, mono: true }, { label: "Period", value: `${c.date(p.periodStart)} – ${c.date(p.periodEnd)}` }, { label: "Paid with", value: p.cardLabel }, { label: "Paid on", value: c.dateTime(p.paidAt) }, { label: "Next renewal", value: c.date(p.periodEnd) }] },
    { type: "button", label: "Manage plan", href: p.manageUrl },
  ],
  sample: { ...sampleSubscriber, invoiceNumber: "INV-20261111-4c1e9a02", paidAt: "2026-11-11T09:01:00.000Z", periodStart: "2026-11-11T09:00:00.000Z", periodEnd: "2026-12-11T09:00:00.000Z", lineItems: sampleItems, total: ngn(5000), cardLabel: "Mastercard •••• 5521", firstCharge: false },
});

export const subscriptionPaymentFailed = defineEmailTemplate<SubscriberProps & { readonly attempt: number; readonly retryAt?: string; readonly downgradeAt: string; readonly graceEndsAt?: string; readonly reason: string; readonly amount: Money; readonly cardLabel: string; readonly payUrl: string; readonly trialConversion: boolean }>({
  ...base, key: "subscriptionPaymentFailed", name: "Plan payment failed (each retry)", trigger: "subscriptionPayment.failed (attempt 1–4)",
  subject: (p) => (p.graceEndsAt ? `Last chance to keep ${p.planLabel}` : p.attempt === 1 ? `We couldn't charge your card for ${p.planLabel}` : `Payment still failing for ${p.planLabel}`),
  preheader: (p, c) => (p.retryAt ? `We'll try again ${c.date(p.retryAt)}. Your plan ends ${c.date(p.downgradeAt)} if it stays unpaid.` : `Pay by ${c.date(p.downgradeAt)} to keep ${p.planLabel}.`),
  blocks: (p, c) => [
    { type: "hero", eyebrow: `Payment failed · attempt ${p.attempt}`, title: p.graceEndsAt ? "Your plan is in its 7-day grace period" : "Your plan payment didn't go through", tone: p.graceEndsAt ? "danger" : "warn" },
    { type: "paragraph", text: [`Hi ${p.firstName}, we tried to charge `, { strong: c.money(p.amount) }, ` to ${p.cardLabel} for ${p.accountName}'s ${p.planLabel}.`] },
    { type: "callout", tone: "danger", title: "Reason", text: p.reason },
    { type: "details", rows: [...(p.retryAt ? [{ label: "Next automatic try", value: c.dateTime(p.retryAt) }] : []), { label: p.trialConversion ? "Trial features end" : "Plan ends if unpaid", value: c.date(p.downgradeAt), strong: true }] },
    { type: "button", label: "Pay now or update card", href: p.payUrl, tone: "danger" },
    { type: "paragraph", muted: true, text: "Your plan stays active until then. If it ends, you move to Free and the checkmark comes off, unless you also hold it on its own." },
  ],
  sample: { ...sampleSubscriber, attempt: 1, retryAt: "2026-11-12T09:00:00.000Z", downgradeAt: "2026-11-23T09:00:00.000Z", reason: "Your bank declined the payment for insufficient funds.", amount: ngn(5000), cardLabel: "Mastercard •••• 5521", payUrl: "https://dashboard.zudomart.com/settings/billing/pay", trialConversion: false },
});

export const subscriptionGraceEnding = defineEmailTemplate<SubscriberProps & { readonly graceEndsAt: string; readonly amount: Money; readonly payUrl: string }>({
  ...base, key: "subscriptionGraceEnding", name: "Grace period ending (48 hours)", trigger: "subscriptionGrace.ending (T-48h)",
  subject: (p) => `${p.planLabel} ends in 2 days`,
  preheader: (p, c) => `Pay ${c.money(p.amount)} before ${c.dateTime(p.graceEndsAt)} to keep it.`,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Grace period", title: `Keep ${p.planLabel} for ${p.accountName}`, tone: "danger" },
    { type: "paragraph", text: ["Your grace period ends ", { strong: c.dateTime(p.graceEndsAt) }, ". After that you'll move to the Free plan."] },
    { type: "button", label: `Pay ${c.money(p.amount)} now`, href: p.payUrl, tone: "danger" },
  ],
  sample: { ...sampleSubscriber, graceEndsAt: "2026-11-23T09:00:00.000Z", amount: ngn(5000), payUrl: "https://dashboard.zudomart.com/settings/billing/pay" },
});

export const subscriptionDowngraded = defineEmailTemplate<SubscriberProps & { readonly checkmarkRemoved: boolean; readonly trialEnded: boolean }>({
  ...base, key: "subscriptionDowngraded", name: "Moved to Free after unpaid renewal", trigger: "subscription.downgraded",
  subject: (p) => `${p.accountName} is now on the Free plan`,
  preheader: (p) => `We couldn't collect payment for ${p.planLabel}. You can come back any time.`,
  blocks: (p) => [
    { type: "hero", eyebrow: "Plan ended", title: "You're on the Free plan", tone: "neutral" },
    { type: "paragraph", text: `Hi ${p.firstName}, we couldn't collect payment for ${p.planLabel}${p.trialEnded ? " when your trial ended" : ""}, so ${p.accountName} moved to Free. Nothing you made is deleted, and basic selling stays on.` },
    ...(p.checkmarkRemoved ? [{ type: "callout" as const, tone: "warn" as const, text: "The checkmark that came with the plan has been removed." }] : []),
    { type: "button", label: "Resubscribe", href: p.manageUrl },
  ],
  sample: { ...sampleSubscriber, checkmarkRemoved: true, trialEnded: false },
});

export const subscriptionCardExpiring = defineEmailTemplate<SubscriberProps & { readonly cardLabel: string; readonly expiryMonth: number; readonly expiryYear: number; readonly chargeAt: string; readonly updateCardUrl: string }>({
  ...base, key: "subscriptionCardExpiring", name: "Card expires before the next renewal", trigger: "subscriptionCard.expiring",
  subject: () => "Your card expires before your next renewal",
  preheader: (p, c) => `${p.cardLabel} expires ${String(p.expiryMonth).padStart(2, "0")}/${p.expiryYear}. Next charge ${c.date(p.chargeAt)}.`,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Card expiring", title: "Update your card to avoid a missed payment", tone: "warn" },
    { type: "details", rows: [{ label: "Card", value: p.cardLabel }, { label: "Expires", value: `${String(p.expiryMonth).padStart(2, "0")}/${p.expiryYear}` }, { label: "Next charge", value: c.date(p.chargeAt) }] },
    { type: "button", label: "Update card", href: p.updateCardUrl },
  ],
  sample: { ...sampleSubscriber, cardLabel: "Visa •••• 4081", expiryMonth: 11, expiryYear: 2026, chargeAt: "2026-12-04T09:00:00.000Z", updateCardUrl: "https://dashboard.zudomart.com/settings/billing/payment-method" },
});

export const subscriptionPriceChange = defineEmailTemplate<SubscriberProps & { readonly oldPrice: Money; readonly newPrice: Money; readonly effectiveAt: string; readonly cancelUrl: string }>({
  ...base, key: "subscriptionPriceChange", name: "Price change notice (30 days ahead)", trigger: "subscriptionPrice.changeNotice", consent: consentRules.legal,
  subject: (p, c) => `${p.planLabel} price changes on ${c.date(p.effectiveAt)}`,
  preheader: (p, c) => `${c.money(p.oldPrice)} → ${c.money(p.newPrice)} per ${p.interval} from ${c.date(p.effectiveAt)}.`,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Price update", title: `Your ${p.planLabel} price is changing`, tone: "brand" },
    { type: "paragraph", text: [`Hi ${p.firstName}, from your renewal on `, { strong: c.date(p.effectiveAt) }, ` ${p.accountName} will pay `, { strong: `${c.money(p.newPrice)} per ${p.interval}` }, ` instead of ${c.money(p.oldPrice)}. Until then nothing changes.`] },
    { type: "button", label: "Review my plan", href: p.manageUrl },
    { type: "links", items: [{ label: "Cancel before the new price", href: p.cancelUrl }] },
  ],
  sample: { ...sampleSubscriber, oldPrice: ngn(5000), newPrice: ngn(6000), effectiveAt: "2026-12-04T09:00:00.000Z", cancelUrl: "https://dashboard.zudomart.com/settings/billing/cancel" },
});

