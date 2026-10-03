import type { Money } from "../emailTypes";
import { ngn } from "../samples/sampleData";
import { consentRules, defineEmailTemplate } from "./defineTemplate";

const base = { category: "seller", kind: "transactional", audience: "Seller", consent: consentRules.always } as const;

type PlanName = "Pro" | "Business" | "Gold";

interface PlanProps {
  readonly firstName: string;
  readonly storeName: string;
  readonly plan: PlanName;
  readonly price: Money;
  readonly interval: "month" | "year";
}

interface DocumentsProps {
  readonly firstName: string;
  readonly storeName: string;
  readonly documents: readonly string[];
}

const samplePlan: PlanProps = { firstName: "Tobi", storeName: "Adire Lagos Studio", plan: "Pro", price: ngn(5000), interval: "month" };
const sampleDocs: DocumentsProps = { firstName: "Tobi", storeName: "Adire Lagos Studio", documents: ["CAC certificate (RC 1928374)", "Director's NIN slip", "Utility bill (proof of address)"] };
const planPerks: Record<PlanName, readonly string[]> = {
  Pro: ["Gold business checkmark once your business is verified", "Lower platform fee on every order", "Live shopping with product pins"],
  Business: ["Everything in Pro", "Team seats and roles", "Priority support and advanced analytics"],
  Gold: ["Gold checkmark for a non-selling brand", "Protected brand handle", "Priority brand support"],
};
const billing = (c: { readonly brand: { readonly sellerDashboardUrl: string } }) => `${c.brand.sellerDashboardUrl}/settings/billing`;

export const documentsReceived = defineEmailTemplate<DocumentsProps & { readonly reviewWithinDays: number }>({
  ...base, key: "documentsReceived", name: "Business documents received", trigger: "verification.business_documents.submitted",
  subject: () => "We received your business documents",
  preheader: (p) => `We'll review them within ${p.reviewWithinDays} business days. Your store stays open meanwhile.`,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Business verification", title: "Documents received" },
    { type: "steps", items: [{ title: "Submitted", text: "We have your files.", state: "done" }, { title: "In review", text: `A specialist checks them within ${p.reviewWithinDays} business days.`, state: "current" }, { title: "Decision", text: "We'll email you either way.", state: "todo" }] },
    { type: "list", title: "What you sent", items: p.documents },
    { type: "paragraph", muted: true, text: "You can keep selling while we review. Verification unlocks the Gold checkmark on paid plans and direct payments." },
    { type: "button", label: "View verification status", href: `${c.brand.sellerDashboardUrl}/settings/verification` },
  ],
  sample: { ...sampleDocs, reviewWithinDays: 3 },
});

export const documentsApproved = defineEmailTemplate<DocumentsProps>({
  ...base, key: "documentsApproved", name: "Business documents approved", trigger: "verification.business_documents.approved",
  subject: (p) => `${p.storeName} is now a verified business`,
  preheader: () => "Buyers will see your verified badge and success rate.",
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Business verification", title: "You're verified", tone: "success" },
    { type: "paragraph", text: `Congratulations, ${p.firstName}. We verified ${p.storeName}. Buyers can now choose direct payment with you, and your success rate shows on your store.` },
    { type: "callout", tone: "brand", title: "Get the Gold checkmark", text: "Gold comes with Pro and Business plans. Upgrade any time from billing." },
    { type: "button", label: "See plans", href: billing(c) },
  ],
  sample: sampleDocs,
});

export const documentsRejected = defineEmailTemplate<DocumentsProps & { readonly issues: readonly string[] }>({
  ...base, key: "documentsRejected", name: "Business documents need changes", trigger: "verification.business_documents.rejected",
  subject: () => "Your business documents need another look",
  preheader: (p) => `${p.issues.length} thing${p.issues.length === 1 ? "" : "s"} to fix, then resubmit.`,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Business verification", title: "We couldn't verify your business yet", tone: "warn" },
    { type: "paragraph", text: `Hi ${p.firstName}, we reviewed the documents for ${p.storeName}. Your store stays open, but we need a few fixes before we can verify it.` },
    { type: "list", title: "What to fix", items: p.issues },
    { type: "button", label: "Upload new documents", href: `${c.brand.sellerDashboardUrl}/settings/verification` },
  ],
  sample: { ...sampleDocs, issues: ["The CAC certificate is cut off at the bottom. Upload the full page.", "The utility bill is older than 3 months."] },
});

export const planTrialStarted = defineEmailTemplate<PlanProps & { readonly trialEndsAt: string; readonly cardLabel: string; readonly verificationCharge: Money }>({
  ...base, key: "planTrialStarted", name: "Plan trial started", trigger: "billing.trial.started",
  subject: (p) => `Your ${p.plan} trial has started`,
  preheader: (p, c) => `Free until ${c.date(p.trialEndsAt)}. Cancel any time before then.`,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Free trial", title: `${p.plan} is on, free until ${c.date(p.trialEndsAt)}`, tone: "success" },
    { type: "list", title: `What ${p.storeName} gets`, items: planPerks[p.plan] },
    { type: "details", rows: [{ label: "Trial ends", value: c.date(p.trialEndsAt) }, { label: "Then", value: `${c.money(p.price)} / ${p.interval}` }, { label: "Card", value: p.cardLabel }, { label: "Card check", value: `${c.money(p.verificationCharge)}, refunded` }] },
    { type: "paragraph", muted: true, text: "We'll remind you 3 days and 1 day before the trial ends. Cancel before then and you won't be charged." },
    { type: "button", label: "Manage plan", href: billing(c) },
  ],
  sample: { ...samplePlan, trialEndsAt: "2026-10-10T09:00:00.000Z", cardLabel: "Mastercard •••• 5521", verificationCharge: ngn(50) },
});

export const planTrialEnding = defineEmailTemplate<PlanProps & { readonly daysLeft: 3 | 1; readonly trialEndsAt: string; readonly cardLabel: string }>({
  ...base, key: "planTrialEnding", name: "Plan trial ending (3 days / 1 day)", trigger: "billing.trial.ending (T-3d, T-1d)",
  subject: (p) => (p.daysLeft === 1 ? `Your ${p.plan} trial ends tomorrow` : `${p.daysLeft} days left in your ${p.plan} trial`),
  preheader: (p, c) => `We'll charge ${c.money(p.price)} to ${p.cardLabel} on ${c.date(p.trialEndsAt)}.`,
  blocks: (p, c) => [
    { type: "hero", eyebrow: p.daysLeft === 1 ? "Ends tomorrow" : `${p.daysLeft} days left`, title: `Your ${p.plan} trial ends ${c.date(p.trialEndsAt)}`, tone: "warn" },
    { type: "paragraph", text: ["To keep your plan, do nothing. We'll charge ", { strong: `${c.money(p.price)} / ${p.interval}` }, ` to ${p.cardLabel} when the trial ends.`] },
    { type: "button", label: "Keep my plan", href: billing(c) },
    { type: "links", items: [{ label: "Switch to yearly and save", href: `${billing(c)}?interval=year` }, { label: "Cancel trial", href: `${billing(c)}/cancel` }] },
  ],
  sample: { ...samplePlan, daysLeft: 3, trialEndsAt: "2026-10-10T09:00:00.000Z", cardLabel: "Mastercard •••• 5521" },
});

export const planTrialConverted = defineEmailTemplate<PlanProps & { readonly nextBillingAt: string; readonly invoiceNumber: string }>({
  ...base, key: "planTrialConverted", name: "Trial converted", trigger: "billing.trial.converted",
  subject: (p) => `Welcome to ${p.plan}`,
  preheader: (p, c) => `First payment of ${c.money(p.price)} received. Receipt inside.`,
  reference: (p) => p.invoiceNumber,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Plan active", title: `${p.storeName} is on ${p.plan}`, tone: "success" },
    { type: "details", rows: [{ label: "Paid", value: c.money(p.price), strong: true }, { label: "Next billing", value: c.date(p.nextBillingAt) }, { label: "Invoice", value: p.invoiceNumber, mono: true }] },
    { type: "button", label: "Download invoice", href: `${billing(c)}/invoices/${p.invoiceNumber}` },
  ],
  sample: { ...samplePlan, nextBillingAt: "2026-11-10T09:00:00.000Z", invoiceNumber: "INV-2026-004812" },
});

export const planPaymentFailed = defineEmailTemplate<PlanProps & { readonly cardLabel: string; readonly reason: string; readonly retryAt: string; readonly downgradeAt: string }>({
  ...base, key: "planPaymentFailed", name: "Plan payment failed", trigger: "billing.invoice.payment_failed",
  subject: (p) => `We couldn't renew your ${p.plan} plan`,
  preheader: (p, c) => `Update your card before ${c.date(p.downgradeAt)} to keep ${p.plan}.`,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Payment failed", title: "Your plan payment didn't go through", tone: "danger" },
    { type: "paragraph", text: [`Hi ${p.firstName}, we tried to charge `, { strong: c.money(p.price) }, ` to ${p.cardLabel} for ${p.storeName}'s ${p.plan} plan. ${p.reason}`] },
    { type: "details", rows: [{ label: "Next attempt", value: c.dateTime(p.retryAt) }, { label: "Plan ends if unpaid", value: c.date(p.downgradeAt), strong: true }] },
    { type: "button", label: "Update payment method", href: `${billing(c)}/payment-method`, tone: "danger" },
    { type: "paragraph", muted: true, text: "If the plan ends, your store stays open on Free, but you'll lose the Gold checkmark and plan perks." },
  ],
  sample: { ...samplePlan, cardLabel: "Mastercard •••• 5521", reason: "Your bank declined it for insufficient funds.", retryAt: "2026-10-12T09:00:00.000Z", downgradeAt: "2026-10-17T09:00:00.000Z" },
});

export const planReceipt = defineEmailTemplate<PlanProps & { readonly invoiceNumber: string; readonly paidAt: string; readonly periodStart: string; readonly periodEnd: string; readonly cardLabel: string; readonly vat: Money; readonly discount?: Money }>({
  ...base, key: "planReceipt", name: "Plan receipt / invoice", trigger: "billing.invoice.paid",
  subject: (p) => `Receipt for ${p.storeName} — ${p.plan} plan`,
  preheader: (p, c) => `${c.money({ ...p.price, amountMinor: p.price.amountMinor + p.vat.amountMinor - (p.discount?.amountMinor ?? 0) })} paid on ${c.date(p.paidAt)}.`,
  reference: (p) => p.invoiceNumber,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Receipt", title: "Thanks — your plan is paid", tone: "success" },
    { type: "details", title: "Invoice", rows: [{ label: "Invoice number", value: p.invoiceNumber, mono: true }, { label: "Billed to", value: p.storeName }, { label: "Period", value: `${c.date(p.periodStart)} – ${c.date(p.periodEnd)}` }, { label: "Paid with", value: p.cardLabel }, { label: "Paid on", value: c.dateTime(p.paidAt) }] },
    { type: "totals", rows: [{ label: `${p.plan} plan (${p.interval}ly)`, amount: p.price }, ...(p.discount ? [{ label: "Discount", amount: p.discount, credit: true }] : []), { label: "VAT (7.5%)", amount: p.vat }], total: { label: "Total paid", amount: { ...p.price, amountMinor: p.price.amountMinor + p.vat.amountMinor - (p.discount?.amountMinor ?? 0) } } },
    { type: "button", label: "Download PDF invoice", href: `${billing(c)}/invoices/${p.invoiceNumber}` },
  ],
  sample: { ...samplePlan, invoiceNumber: "INV-2026-004813", paidAt: "2026-11-10T09:02:00.000Z", periodStart: "2026-11-10T00:00:00.000Z", periodEnd: "2026-12-09T23:59:00.000Z", cardLabel: "Mastercard •••• 5521", vat: ngn(375) },
});
