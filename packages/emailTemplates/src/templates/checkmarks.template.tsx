import type { Money, StepState } from "../emailTypes";
import { ngn } from "../samples/sampleData";
import { consentRules, defineEmailTemplate } from "./defineTemplate";

type Checkmark = "Blue" | "Gold" | "Black";

const base = { category: "checkmarks", kind: "transactional", audience: "Applicant or checkmark holder", consent: consentRules.always } as const;
const tint = (mark: Checkmark) => (mark === "Gold" ? "warn" : mark === "Black" ? "neutral" : "brand");
const verificationUrl = (c: { readonly url: (path: string) => string }) => c.url("/settings/verification");

interface MarkProps {
  readonly firstName: string;
  readonly checkmark: Checkmark;
  readonly accountName: string;
}

export const checkmarkSuggestion = defineEmailTemplate<MarkProps & { readonly price: Money; readonly reasons: readonly string[] }>({
  ...base, key: "checkmarkSuggestion", name: "Checkmark suggestion", audience: "Eligible user", trigger: "verification.suggestion.created (rule-based)", consent: consentRules.transactionalOptOut,
  subject: (p) => `${p.accountName} qualifies for the ${p.checkmark} checkmark`,
  preheader: (p, c) => `${c.money(p.price)} a month. Show buyers and fans you're the real thing.`,
  blocks: (p, c) => [
    { type: "hero", eyebrow: `${p.checkmark} checkmark`, title: `${p.accountName} is ready for a checkmark`, tone: tint(p.checkmark) },
    { type: "list", title: "Why you qualify", items: p.reasons },
    { type: "paragraph", text: [`The ${p.checkmark} checkmark costs `, { strong: `${c.money(p.price)} / month` }, ". It's renewed monthly and you can cancel any time."] },
    { type: "button", label: "Get verified", href: verificationUrl(c) },
  ],
  sample: { firstName: "Amaka", checkmark: "Blue", accountName: "@amaka.styles", price: ngn(2500), reasons: ["Your profile is complete and your email address is verified.", "Your account is over 30 days old with no strikes.", "You've been active every week this month."] },
});

export const checkmarkApplicationReceived = defineEmailTemplate<MarkProps & { readonly applicationId: string; readonly reviewWithinDays: number }>({
  ...base, key: "checkmarkApplicationReceived", name: "Checkmark application received", trigger: "verification.application.submitted",
  subject: (p) => `We received your ${p.checkmark} checkmark application`,
  preheader: (p) => `We'll decide within ${p.reviewWithinDays} days.`,
  reference: (p) => p.applicationId,
  blocks: (p, c) => [
    { type: "hero", eyebrow: `${p.checkmark} checkmark`, title: "Application received", tone: tint(p.checkmark) },
    { type: "paragraph", text: `Hi ${p.firstName}, we're reviewing ${p.accountName}. You won't be charged unless you're approved.` },
    { type: "button", label: "View status", href: verificationUrl(c) },
  ],
  sample: { firstName: "Tobi", checkmark: "Gold", accountName: "Adire Lagos Studio", applicationId: "VER-88130", reviewWithinDays: 3 },
});

export const checkmarkApproved = defineEmailTemplate<MarkProps & { readonly renewsAt: string }>({
  ...base, key: "checkmarkApproved", name: "Checkmark approved", trigger: "verification.application.approved",
  subject: (p) => `${p.accountName} is now verified`,
  preheader: (p) => `Your ${p.checkmark} checkmark is live everywhere on Zudomart.`,
  blocks: (p, c) => [
    { type: "hero", eyebrow: `${p.checkmark} checkmark`, title: "You're verified", tone: "success" },
    { type: "paragraph", text: `Congratulations, ${p.firstName}. The ${p.checkmark} checkmark now shows next to ${p.accountName} on your profile, posts, lives and store.` },
    { type: "callout", tone: "neutral", text: `Changing your name or handle sends your checkmark back to review. It renews on ${c.date(p.renewsAt)}.` },
    { type: "button", label: "See your profile", href: c.url("/me") },
  ],
  sample: { firstName: "Tobi", checkmark: "Gold", accountName: "Adire Lagos Studio", renewsAt: "2026-11-03T09:00:00.000Z" },
});

export const checkmarkRejected = defineEmailTemplate<MarkProps & { readonly reasons: readonly string[]; readonly reapplyFrom: string }>({
  ...base, key: "checkmarkRejected", name: "Checkmark not approved", trigger: "verification.application.rejected",
  subject: (p) => `Your ${p.checkmark} checkmark application wasn't approved`,
  preheader: (p, c) => `You can apply again from ${c.date(p.reapplyFrom)}.`,
  blocks: (p, c) => [
    { type: "hero", eyebrow: `${p.checkmark} checkmark`, title: "We couldn't approve this application", tone: "danger" },
    { type: "paragraph", text: `Hi ${p.firstName}, we reviewed ${p.accountName} and can't grant the checkmark right now. You haven't been charged.` },
    { type: "list", title: "What we found", items: p.reasons },
    { type: "paragraph", text: `Fix these and apply again from ${c.date(p.reapplyFrom)}.` },
    { type: "button", label: "Review requirements", href: verificationUrl(c) },
  ],
  sample: { firstName: "Amaka", checkmark: "Blue", accountName: "@amaka.styles", reasons: ["The name on your ID doesn't match your profile name.", "Your profile photo doesn't clearly show your face."], reapplyFrom: "2026-11-02T00:00:00.000Z" },
});

export const blackVettingUpdate = defineEmailTemplate<MarkProps & { readonly caseId: string; readonly steps: readonly { readonly title: string; readonly text: string; readonly state: StepState }[]; readonly actionNeeded?: string }>({
  ...base, key: "blackVettingUpdate", name: "Black checkmark vetting steps", audience: "Government applicant", trigger: "verification.black.vetting_step_changed",
  subject: (p) => (p.actionNeeded ? `Action needed on your Black checkmark vetting` : `Black checkmark vetting: next step`),
  preheader: (p) => p.actionNeeded ?? "Your application moved to the next stage.",
  reference: (p) => p.caseId,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Black checkmark", title: `Vetting for ${p.accountName}`, tone: "neutral" },
    { type: "paragraph", text: "The Black checkmark is for government bodies. Every application gets deep vetting and two independent admin approvals." },
    { type: "steps", items: p.steps },
    ...(p.actionNeeded ? [{ type: "callout" as const, tone: "warn" as const, title: "We need something from you", text: p.actionNeeded }] : []),
    { type: "button", label: "Open vetting case", href: verificationUrl(c) },
  ],
  sample: { firstName: "Ifeoma", checkmark: "Black", accountName: "Lagos State Ministry of Commerce", caseId: "BLK-0042", steps: [{ title: "Application", text: "Official letter and contact details received.", state: "done" }, { title: "Domain and identity checks", text: "We confirmed your .gov.ng domain and signatory.", state: "done" }, { title: "Authority confirmation", text: "We're confirming the account with your agency's official contact.", state: "current" }, { title: "Two-admin approval", text: "Two senior admins sign off independently.", state: "todo" }], actionNeeded: "Reply from your official .gov.ng address to confirm the named account managers." },
});

export const checkmarkRenewalDue = defineEmailTemplate<MarkProps & { readonly price: Money; readonly failedAt: string; readonly graceEndsAt: string }>({
  ...base, key: "checkmarkRenewalDue", name: "Checkmark renewal due (14-day grace)", trigger: "verification.renewal.payment_failed",
  subject: (p) => `Keep your ${p.checkmark} checkmark — renewal failed`,
  preheader: (p, c) => `You have until ${c.date(p.graceEndsAt)} to update payment.`,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Renewal", title: "Your checkmark is in a 14-day grace period", tone: "warn" },
    { type: "paragraph", text: [`Hi ${p.firstName}, we couldn't take `, { strong: c.money(p.price) }, ` on ${c.date(p.failedAt)} for ${p.accountName}. Your checkmark stays on until `, { strong: c.date(p.graceEndsAt) }, "."] },
    { type: "button", label: "Update payment", href: c.url("/settings/subscriptions") },
    { type: "paragraph", muted: true, text: "If we can't collect payment by then, the checkmark comes off. You can renew later, but it may need review again." },
  ],
  sample: { firstName: "Tobi", checkmark: "Gold", accountName: "Adire Lagos Studio", price: ngn(3000), failedAt: "2026-10-03T09:00:00.000Z", graceEndsAt: "2026-10-17T09:00:00.000Z" },
});

export const checkmarkRevoked = defineEmailTemplate<MarkProps & { readonly reason: string; readonly appealUrl: string }>({
  ...base, key: "checkmarkRevoked", name: "Checkmark revoked", trigger: "verification.checkmark.revoked",
  subject: (p) => `Your ${p.checkmark} checkmark was removed`,
  preheader: (p) => p.reason,
  blocks: (p) => [
    { type: "hero", eyebrow: `${p.checkmark} checkmark`, title: "We removed your checkmark", tone: "danger" },
    { type: "paragraph", text: `Hi ${p.firstName}, the ${p.checkmark} checkmark is no longer shown on ${p.accountName}. Any unused paid time is refunded.` },
    { type: "callout", tone: "danger", title: "Reason", text: p.reason },
    { type: "button", label: "Appeal this decision", href: p.appealUrl },
  ],
  sample: { firstName: "Amaka", checkmark: "Blue", accountName: "@amaka.styles", reason: "Your account was used to impersonate another creator, which breaks our verification rules.", appealUrl: "https://zudomart.com/appeals/new?type=checkmark" },
});
