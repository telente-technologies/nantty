import type { Money } from "../emailTypes";
import { ngn } from "../samples/sampleData";
import { consentRules, defineEmailTemplate } from "./defineTemplate";

const base = { category: "creator", kind: "transactional", audience: "Creator", consent: consentRules.always } as const;
const studio = (c: { readonly brand: { readonly studioUrl: string } }, path: string) => `${c.brand.studioUrl}${path}`;

interface Requirement {
  readonly label: string;
  readonly value: number;
  readonly target: number;
  readonly display?: string;
}

const sampleRequirements: readonly Requirement[] = [
  { label: "Followers", value: 6420, target: 10000 },
  { label: "Watch hours (last 90 days)", value: 4000, target: 4000 },
  { label: "Original posts (last 30 days)", value: 9, target: 12 },
  { label: "No community guideline strikes", value: 1, target: 1, display: "Clear" },
];

export const creatorApplicationReceived = defineEmailTemplate<{ readonly firstName: string; readonly applicationId: string; readonly decisionWithinDays: number }>({
  ...base, key: "creatorApplicationReceived", name: "Creator application received", trigger: "creator.application.submitted",
  subject: () => "We got your Creator Program application",
  preheader: (p) => `Most decisions arrive within ${p.decisionWithinDays} days.`,
  reference: (p) => p.applicationId,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Creator Program", title: "Application received" },
    { type: "steps", items: [{ title: "Applied", text: "We have everything we need.", state: "done" }, { title: "Checks", text: "We look at your eligibility, account history and originality.", state: "current" }, { title: "Decision", text: `Usually within ${p.decisionWithinDays} days.`, state: "todo" }] },
    { type: "button", label: "View application", href: studio(c, "/creator-program") },
  ],
  sample: { firstName: "Kemi", applicationId: "CRA-55018", decisionWithinDays: 5 },
});

export const creatorApproved = defineEmailTemplate<{ readonly firstName: string; readonly handle: string }>({
  ...base, key: "creatorApproved", name: "Creator approved", trigger: "creator.application.approved",
  subject: () => "You're in the Nantty Creator Program",
  preheader: () => "Earn from ads revenue share, gifts and subscriptions.",
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Creator Program", title: `Welcome aboard, @${p.handle}`, tone: "success" },
    { type: "paragraph", text: `Congratulations, ${p.firstName}. Your account now earns from the Creator Program.` },
    { type: "list", title: "Ways you earn", items: [[{ strong: "Ads revenue share" }, " — a share of eligible ad revenue on your content. We don't pay for views; we share revenue."], [{ strong: "Live gifts" }, " — fans send coins as gifts during your lives."], [{ strong: "Premium pool" }, " — a share of Premium subscriptions based on time spent on your content."]] },
    { type: "button", label: "Set up payouts", href: studio(c, "/earnings/payouts") },
    { type: "links", items: [{ label: "Creator Program terms", href: c.url("/legal/creator-terms") }, { label: "Monetisation guidelines", href: c.url("/help/creator-monetisation") }] },
  ],
  sample: { firstName: "Kemi", handle: "kemicooks" },
});

export const creatorNeedsReview = defineEmailTemplate<{ readonly firstName: string; readonly applicationId: string; readonly reviewWithinDays: number }>({
  ...base, key: "creatorNeedsReview", name: "Creator application in manual review", trigger: "creator.application.manual_review",
  subject: () => "Your Creator Program application is with our team",
  preheader: (p) => `A person will review it within ${p.reviewWithinDays} days.`,
  reference: (p) => p.applicationId,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Creator Program", title: "A specialist is taking a closer look", tone: "warn" },
    { type: "paragraph", text: `Hi ${p.firstName}, your account meets the numbers, but some of your content needs a human check before we decide — usually to confirm it's original. There's nothing you need to do.` },
    { type: "paragraph", text: `Expect a decision within ${p.reviewWithinDays} days.` },
    { type: "button", label: "View application", href: studio(c, "/creator-program") },
  ],
  sample: { firstName: "Kemi", applicationId: "CRA-55018", reviewWithinDays: 7 },
});

export const creatorNotEligibleYet = defineEmailTemplate<{ readonly firstName: string; readonly requirements: readonly Requirement[]; readonly reapplyFrom?: string }>({
  ...base, key: "creatorNotEligibleYet", name: "Creator not eligible yet (progress)", trigger: "creator.application.not_eligible",
  subject: () => "You're close — here's what's left for the Creator Program",
  preheader: (p) => `${p.requirements.filter((item) => item.value >= item.target).length} of ${p.requirements.length} requirements met.`,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Creator Program", title: "Not quite yet — but you're getting there" },
    { type: "paragraph", text: `Hi ${p.firstName}, here's where you stand. We update this every day, and you can apply again as soon as everything's green.` },
    { type: "progress", items: p.requirements },
    { type: "button", label: "Track your progress", href: studio(c, "/creator-program") },
    ...(p.reapplyFrom ? [{ type: "paragraph" as const, muted: true, text: `You can reapply from ${c.date(p.reapplyFrom)}.` }] : []),
  ],
  sample: { firstName: "Kemi", requirements: sampleRequirements },
});

export const creatorEarningsStatement = defineEmailTemplate<{ readonly firstName: string; readonly periodLabel: string; readonly adsShare: Money; readonly gifts: Money; readonly premiumPool: Money; readonly storeFees: Money; readonly total: Money; readonly statementId: string }>({
  ...base, key: "creatorEarningsStatement", name: "Creator earnings statement", trigger: "creator.statement.generated (monthly)", consent: consentRules.transactionalOptOut,
  subject: (p, c) => `${p.periodLabel} earnings: ${c.money(p.total)}`,
  preheader: () => "Your monthly breakdown of ads, gifts and Premium earnings.",
  reference: (p) => p.statementId,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Earnings statement", title: `You earned ${c.money(p.total)} in ${p.periodLabel}`, tone: "success" },
    { type: "totals", rows: [{ label: "Ads revenue share", amount: p.adsShare }, { label: "Live and post gifts", amount: p.gifts }, { label: "Premium pool", amount: p.premiumPool }, { label: "App store fees on in-app gifts", amount: p.storeFees, credit: true }], total: { label: "Total earnings", amount: p.total } },
    { type: "paragraph", muted: true, text: "Earnings are final after fraud checks, which can adjust invalid views or gifts. Creator share is calculated after Apple and Google fees." },
    { type: "button", label: "Open full statement", href: studio(c, `/earnings/statements/${p.statementId}`) },
  ],
  sample: { firstName: "Kemi", periodLabel: "September 2026", adsShare: ngn(38400), gifts: ngn(91250), premiumPool: ngn(12600), storeFees: ngn(9800), total: ngn(132450), statementId: "ST-2026-09-0441" },
});

export const creatorGiftMilestone = defineEmailTemplate<{ readonly firstName: string; readonly milestone: string; readonly giftCount: number; readonly topSupporters: readonly { readonly name: string; readonly handle: string; readonly note: string }[] }>({
  ...base, key: "creatorGiftMilestone", name: "Gift milestone", trigger: "live.gifts.milestone_reached", consent: consentRules.transactionalOptOut,
  subject: (p) => `You hit ${p.milestone}`,
  preheader: (p) => `${p.giftCount.toLocaleString("en")} gifts from your community. Say thanks!`,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Milestone", title: `${p.milestone}!`, tone: "success" },
    { type: "paragraph", text: `${p.firstName}, your community has sent you ${p.giftCount.toLocaleString("en")} gifts. These are your top supporters:` },
    { type: "people", items: p.topSupporters },
    { type: "button", label: "Thank your supporters", href: studio(c, "/live/supporters") },
  ],
  sample: { firstName: "Kemi", milestone: "10,000 gifts", giftCount: 10000, topSupporters: [{ name: "Bola Ade", handle: "bolaade", note: "1,240 gifts · Top fan" }, { name: "Chidi Okeke", handle: "chidi.o", note: "980 gifts" }, { name: "Zainab Musa", handle: "zainabm", note: "755 gifts" }] },
});

export const creatorPayoutSent = defineEmailTemplate<{ readonly firstName: string; readonly amount: Money; readonly bankAccount: string; readonly payoutId: string; readonly sentAt: string }>({
  ...base, key: "creatorPayoutSent", name: "Creator payout sent", trigger: "creator.payout.paid",
  subject: (p, c) => `${c.money(p.amount)} creator payout sent`,
  preheader: (p) => `To ${p.bankAccount}.`,
  reference: (p) => p.payoutId,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Payout sent", title: `${c.money(p.amount)} is on its way`, tone: "success" },
    { type: "details", rows: [{ label: "Amount", value: c.money(p.amount), strong: true }, { label: "To", value: p.bankAccount }, { label: "Sent", value: c.dateTime(p.sentAt) }, { label: "Payout ID", value: p.payoutId, mono: true }] },
    { type: "button", label: "View earnings", href: studio(c, "/earnings") },
  ],
  sample: { firstName: "Kemi", amount: ngn(132450), bankAccount: "Access Bank •••• 7731", payoutId: "CPO-2026-10-0091", sentAt: "2026-10-05T08:10:00.000Z" },
});
