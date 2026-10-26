import { consentRules, defineEmailTemplate } from "./defineTemplate";

const base = { category: "trust", kind: "transactional", audience: "Affected user", consent: consentRules.always } as const;

interface ActionProps {
  readonly firstName: string;
  readonly caseId: string;
  readonly reason: string;
  readonly policy: string;
  readonly policyUrl: string;
  readonly appealUrl: string;
}

const sampleAction: ActionProps = { firstName: "Amaka", caseId: "TS-3391", reason: "Repeated listings of counterfeit designer bags after two warnings.", policy: "Counterfeit and intellectual property policy", policyUrl: "https://nantty.com/legal/counterfeits", appealUrl: "https://nantty.com/appeals/new?case=TS-3391" };
const policyBlock = (p: ActionProps) => ({ type: "details" as const, rows: [{ label: "Case", value: p.caseId, mono: true }, { label: "Policy", value: p.policy }] });

export const accountRestricted = defineEmailTemplate<ActionProps & { readonly restrictions: readonly string[]; readonly until: string }>({
  ...base, key: "accountRestricted", name: "Account restricted", trigger: "trust.enforcement.restricted",
  subject: () => "Some features on your account are limited",
  preheader: (p, c) => `Until ${c.date(p.until)}. You can still use the rest of Nantty.`,
  reference: (p) => `CASE ${p.caseId}`,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Account restricted", title: `Limited until ${c.date(p.until)}`, tone: "warn" },
    { type: "paragraph", text: `Hi ${p.firstName}, we've limited some features on your account. ${p.reason}` },
    { type: "list", title: "What's limited", items: p.restrictions },
    policyBlock(p),
    { type: "paragraph", text: "Your orders, payouts and messages keep working. Open orders still need to be fulfilled." },
    { type: "button", label: "Appeal", href: p.appealUrl },
    { type: "links", items: [{ label: `Read the ${p.policy}`, href: p.policyUrl }] },
  ],
  sample: { ...sampleAction, restrictions: ["Creating new listings", "Going live"], until: "2026-10-17T00:00:00.000Z" },
});

export const accountSuspended = defineEmailTemplate<ActionProps & { readonly appealBy: string; readonly deletionAt: string }>({
  ...base, key: "accountSuspended", name: "Account suspended", trigger: "trust.enforcement.suspended",
  subject: () => "Your Nantty account is suspended",
  preheader: (p, c) => `You can appeal until ${c.date(p.appealBy)}.`,
  reference: (p) => `CASE ${p.caseId}`,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Account suspended", title: "Your account is suspended", tone: "danger" },
    { type: "paragraph", text: `Hi ${p.firstName}, we suspended your account after a review by our Trust & Safety team.` },
    { type: "callout", tone: "danger", title: "Reason", text: p.reason },
    policyBlock(p),
    { type: "list", title: "What this means", items: [
      "Your profile, posts and store are hidden, and others see a suspended notice.",
      "Money owed to you for completed orders is still paid out, minus any refunds owed to buyers.",
      [{ strong: "After 120 days" }, ` (${c.date(p.deletionAt)}), we delete your profile, posts, media and messages. Order and payment records are kept, anonymised, for the period the law requires.`],
    ] },
    { type: "button", label: "Appeal this decision", href: p.appealUrl },
    { type: "paragraph", muted: true, text: `Appeals are reviewed by a different person from the one who made this decision. Appeal by ${c.date(p.appealBy)}.` },
  ],
  sample: { ...sampleAction, appealBy: "2026-11-02T00:00:00.000Z", deletionAt: "2027-01-31T00:00:00.000Z" },
});

export const appealDecision = defineEmailTemplate<{ readonly firstName: string; readonly caseId: string; readonly outcome: "upheld" | "overturned"; readonly explanation: string }>({
  ...base, key: "appealDecision", name: "Appeal decision", trigger: "trust.appeal.decided",
  subject: (p) => (p.outcome === "overturned" ? "Good news: your appeal was successful" : "We've reviewed your appeal"),
  preheader: (p) => (p.outcome === "overturned" ? "Your account is fully restored." : "The original decision stands."),
  reference: (p) => `CASE ${p.caseId}`,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Appeal decision", title: p.outcome === "overturned" ? "We reversed our decision" : "Our decision stands", tone: p.outcome === "overturned" ? "success" : "neutral" },
    { type: "paragraph", text: p.explanation },
    p.outcome === "overturned" ? { type: "button", label: "Go to Nantty", href: c.url("/") } : { type: "paragraph", muted: true, text: "This was the final review for this case." },
  ],
  sample: { firstName: "Amaka", caseId: "TS-3391", outcome: "overturned", explanation: "A second reviewer found the bags were authentic, backed by the receipts you shared. We've lifted the suspension, restored your listings and removed the strike from your record. Sorry for the trouble." },
});

export const accountBanned = defineEmailTemplate<ActionProps>({
  ...base, key: "accountBanned", name: "Account banned", trigger: "trust.enforcement.banned",
  subject: () => "Your Nantty account has been permanently closed",
  preheader: (p) => p.policy,
  reference: (p) => `CASE ${p.caseId}`,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Account closed", title: "We've permanently closed your account", tone: "danger" },
    { type: "paragraph", text: `Hi ${p.firstName}, after a review we've permanently closed your account for a serious or repeated breach of our rules.` },
    { type: "callout", tone: "danger", title: "Reason", text: p.reason },
    policyBlock(p),
    { type: "paragraph", text: "You can't create a new account. Buyers with open orders will be refunded. Any balance owed to you, after refunds, will be paid to your verified bank account." },
    { type: "links", items: [{ label: "Appeal once", href: p.appealUrl }, { label: "Request a copy of your data", href: c.url("/privacy/data-request") }] },
  ],
  sample: sampleAction,
});

export const reportOutcome = defineEmailTemplate<{ readonly firstName: string; readonly reportId: string; readonly reportedWhat: string; readonly outcome: "action_taken" | "no_violation"; readonly reportedAt: string }>({
  ...base, key: "reportOutcome", name: "Report outcome", audience: "Reporter", trigger: "trust.report.closed", consent: consentRules.transactionalOptOut,
  subject: () => "Update on your report",
  preheader: (p) => (p.outcome === "action_taken" ? "We took action. Thanks for helping keep Nantty safe." : "We reviewed it and didn't find a rule break."),
  reference: (p) => p.reportId,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Your report", title: p.outcome === "action_taken" ? "We took action" : "We reviewed your report", tone: p.outcome === "action_taken" ? "success" : "neutral" },
    { type: "paragraph", text: p.outcome === "action_taken"
      ? `Thanks, ${p.firstName}. You reported ${p.reportedWhat} on ${c.date(p.reportedAt)}. It broke our rules, and we've acted on it. For privacy, we don't share exactly what action we took.`
      : `Thanks, ${p.firstName}. You reported ${p.reportedWhat} on ${c.date(p.reportedAt)}. We didn't find a rule break, but you can still block or mute the account.` },
    { type: "links", items: [{ label: "Block or mute accounts", href: c.url("/help/block-mute") }, { label: "Community guidelines", href: c.url("/legal/community-guidelines") }] },
  ],
  sample: { firstName: "Amaka", reportId: "RPT-90021", reportedWhat: "a listing for a \"designer\" bag", outcome: "action_taken", reportedAt: "2026-10-01T10:00:00.000Z" },
});
