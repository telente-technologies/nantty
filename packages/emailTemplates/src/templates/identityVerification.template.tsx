import type { Money } from "../emailTypes";
import { consentRules, defineEmailTemplate } from "./defineTemplate";

type Checkmark = "Blue" | "Gold";
type RefundMethod = "card" | "google_play" | "apple_request" | "plan_continues" | "plan_share_card" | "plan_share_store";

const base = { category: "checkmarks", kind: "transactional", audience: "Checkmark applicant", consent: consentRules.always } as const;
const hubUrl = (c: { readonly url: (path: string) => string }) => c.url("/settings/verification");

interface MarkProps {
  readonly firstName: string;
  readonly checkmark: Checkmark;
  readonly accountName: string;
}

const refundSentence: Record<Exclude<RefundMethod, "plan_share_card" | "plan_share_store">, string> = {
  card: "We have refunded the full amount to the card you paid with. Banks usually show it within 5 to 10 working days.",
  google_play: "Google Play is refunding the full amount to your Play payment method and the subscription has been cancelled.",
  apple_request: "Your subscription has been cancelled. Apple handles refunds for App Store purchases, so request yours at reportaproblem.apple.com and choose this subscription. Our support team can help if Apple declines.",
  plan_continues: "Your plan keeps working as before; only the checkmark was not added, so there is nothing to refund.",
};

const keepsPlan = (method: RefundMethod) => method === "plan_continues" || method === "plan_share_card" || method === "plan_share_store";

const shareSentence = (method: "plan_share_card" | "plan_share_store", amount: string | undefined): string => {
  const sum = amount ? `${amount} for the checkmark` : "the checkmark's share of your payment";
  return method === "plan_share_card"
    ? `Your plan stays active; we've refunded ${sum} to the card you paid with. Banks usually show it within 5 to 10 working days.`
    : `Your plan stays active. You paid through an app store, so we're arranging ${sum} with the store. If you paid with Apple, request it at reportaproblem.apple.com and choose this subscription; our support team can help.`;
};

export const verificationEligible = defineEmailTemplate<MarkProps & { readonly payUrl: string }>({
  ...base, key: "verificationEligible", name: "You can now apply for verification", trigger: "verification.eligible (Python recheck after a queued request)", consent: consentRules.transactionalOptOut,
  subject: (p) => `You can now apply for the ${p.checkmark} checkmark`,
  preheader: () => "Your account now meets the requirements. Pay, then confirm your identity in a few minutes.",
  blocks: (p) => [
    { type: "hero", eyebrow: `${p.checkmark} checkmark`, title: "You can now apply", tone: p.checkmark === "Gold" ? "warn" : "brand" },
    { type: "paragraph", text: `Hi ${p.firstName}, thanks for waiting. ${p.accountName} now meets the requirements for the ${p.checkmark} checkmark.` },
    { type: "steps", items: [
      { title: "Pay", text: "Choose monthly or yearly. You are only charged once.", state: "current" },
      { title: "Confirm it's you", text: "Choose an identity check available for your country. Depending on the option, you may use a photo ID or enter an ID number securely with Smile ID.", state: "todo" },
      { title: "Get your checkmark", text: "Most people are approved in minutes. If we can't approve you, you get a full refund.", state: "todo" },
    ] },
    { type: "button", label: "Apply now", href: p.payUrl },
  ],
  sample: { firstName: "Amaka", checkmark: "Blue", accountName: "@amaka.styles", payUrl: "https://nantty.com/settings/verification?step=pay" },
});

export const verificationUnderReview = defineEmailTemplate<MarkProps & { readonly caseId: string; readonly reviewWithinDays: number }>({
  ...base, key: "verificationUnderReview", name: "Verification under review", trigger: "verification.underReview",
  subject: (p) => `Your ${p.checkmark} checkmark verification is being reviewed`,
  preheader: (p) => `A person will check it within ${p.reviewWithinDays} days.`,
  reference: (p) => p.caseId,
  blocks: (p, c) => [
    { type: "hero", eyebrow: `${p.checkmark} checkmark`, title: "A person is reviewing your verification", tone: "neutral" },
    { type: "paragraph", text: `Hi ${p.firstName}, we received your identity check for ${p.accountName}. Some results need a closer look, so a member of our trust team will review them within ${p.reviewWithinDays} days.` },
    { type: "callout", tone: "neutral", text: "You don't need to do anything. If we can't approve the checkmark, we refund your payment in full." },
    { type: "button", label: "View status", href: hubUrl(c) },
  ],
  sample: { firstName: "Tobi", checkmark: "Gold", accountName: "Adire Lagos Studio", caseId: "VC-2041", reviewWithinDays: 3 },
});

export const verificationApproved = defineEmailTemplate<MarkProps & { readonly verifiedAt: string }>({
  ...base, key: "verificationApproved", name: "Verification approved", trigger: "verification.approved",
  subject: (p) => `${p.accountName} is now verified`,
  preheader: (p) => `Your ${p.checkmark} checkmark is live on your profile.`,
  blocks: (p, c) => [
    { type: "hero", eyebrow: `${p.checkmark} checkmark`, title: "You're verified", tone: "success" },
    { type: "paragraph", text: `Congratulations, ${p.firstName}. We confirmed your identity on ${c.date(p.verifiedAt)} and the ${p.checkmark} checkmark now shows next to ${p.accountName}.` },
    { type: "callout", tone: "neutral", text: "We kept only the result of the check, never your selfie or face data. Changing your name sends the checkmark back to review." },
    { type: "button", label: "See your profile", href: c.url("/me") },
  ],
  sample: { firstName: "Amaka", checkmark: "Blue", accountName: "@amaka.styles", verifiedAt: "2026-10-04T10:00:00.000Z" },
});

export const verificationRejectedRefunded = defineEmailTemplate<MarkProps & { readonly reasons: readonly string[]; readonly refundMethod: RefundMethod; readonly refundAmount?: Money; readonly reapplyFrom: string }>({
  ...base, key: "verificationRejectedRefunded", name: "Verification not approved and refunded", trigger: "verification.rejectedRefunded",
  subject: (p) => (p.refundMethod === "plan_continues" ? `We couldn't verify ${p.accountName}` : keepsPlan(p.refundMethod) ? `We couldn't verify ${p.accountName}. Your plan stays active` : `We couldn't verify ${p.accountName}. Your refund is on its way`),
  preheader: (p, c) => `You can try again from ${c.date(p.reapplyFrom)}.`,
  blocks: (p, c) => [
    { type: "hero", eyebrow: `${p.checkmark} checkmark`, title: "We couldn't approve your verification", tone: "danger" },
    { type: "paragraph", text: `Hi ${p.firstName}, our trust team reviewed the identity check for ${p.accountName} and could not approve the ${p.checkmark} checkmark.` },
    { type: "list", title: "Why", items: p.reasons },
    { type: "callout", tone: p.refundMethod === "apple_request" ? "warn" : "success", title: "Your money", text: p.refundMethod === "plan_share_card" || p.refundMethod === "plan_share_store" ? shareSentence(p.refundMethod, p.refundAmount ? c.money(p.refundAmount) : undefined) : refundSentence[p.refundMethod] },
    { type: "paragraph", text: `You can try again from ${c.date(p.reapplyFrom)}. Choose a supported identity-check option and make sure the details match your profile.` },
    { type: "button", label: "Open verification", href: hubUrl(c) },
  ],
  sample: { firstName: "Tobi", checkmark: "Blue", accountName: "@tobi.ade", reasons: ["The name on the ID does not match the name on your profile."], refundMethod: "card", reapplyFrom: "2026-11-03T00:00:00.000Z" },
});
