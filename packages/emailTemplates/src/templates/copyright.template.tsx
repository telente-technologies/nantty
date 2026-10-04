import { consentRules, defineEmailTemplate } from "./defineTemplate";

const base = { category: "trust", kind: "transactional", audience: "Affected user", consent: consentRules.always } as const;

interface ContentProps {
  readonly firstName: string;
  readonly claimId: string;
  readonly contentLabel: string;
  readonly contentUrl: string;
  readonly workTitle: string;
  readonly reason: string;
  readonly accountStatusUrl: string;
  readonly helpUrl: string;
}

const sampleContent: ContentProps = {
  firstName: "Tobi", claimId: "0192f0a1-7c3e-7000-8000-00000000c1a1", contentLabel: "your clip “Owambe dance challenge”", contentUrl: "https://zudomart.com/clips/0192f0a1",
  workTitle: "“Lagos Nights” by DJ Kaz (Kaz Records)", reason: "The rights holder showed registration and release records for this song.",
  accountStatusUrl: "https://zudomart.com/settings/account-status", helpUrl: "https://zudomart.com/help/safety-and-reporting/copyright-and-account-status",
};

const claimDetails = (p: ContentProps) => ({ type: "details" as const, rows: [{ label: "Claim", value: p.claimId.slice(0, 8).toUpperCase(), mono: true }, { label: "Claimed work", value: p.workTitle }] });
const counterNoticeRights = (p: ContentProps) => ({
  type: "paragraph" as const, muted: true,
  text: `If you believe this is a mistake, for example you own the work, have a licence, or your use is allowed by law, you can send a counter-notice from your Account status page. A false counter-notice can have legal consequences. Learn more: ${p.helpUrl}`,
});

export const copyrightWarning = defineEmailTemplate<ContentProps & { readonly deadlineAt: string; readonly deadlineHours: number }>({
  ...base, key: "copyrightWarning", name: "Copyright takedown warning", trigger: "copyrightClaim.warningIssued",
  subject: () => "Action needed: remove content that was claimed for copyright",
  preheader: (p, c) => `Remove it by ${c.dateTime(p.deadlineAt)} to avoid a copyright strike.`,
  reference: (p) => `CLAIM ${p.claimId.slice(0, 8).toUpperCase()}`,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Copyright warning", title: `Remove it within ${p.deadlineHours} hours`, tone: "warn" },
    { type: "paragraph", text: `Hi ${p.firstName}, a rights holder reported ${p.contentLabel} for using their video without permission, and our team upheld the claim.` },
    claimDetails(p),
    { type: "callout", tone: "warn", title: `Deadline: ${c.dateTime(p.deadlineAt)}`, text: "If you delete it before the deadline, there is no strike. This warning stays on your record. If it is still up at the deadline, we take it down and add a copyright strike to your account." },
    { type: "button", label: "Review the content", href: p.contentUrl },
    counterNoticeRights(p),
    { type: "links", items: [{ label: "Account status", href: p.accountStatusUrl }] },
  ],
  sample: { ...sampleContent, deadlineAt: "2026-10-06T09:00:00.000Z", deadlineHours: 48 },
});

export const audioMuted = defineEmailTemplate<ContentProps>({
  ...base, key: "audioMuted", name: "Copyright audio muted", trigger: "copyrightClaim.audioMuteOrdered",
  subject: () => "We muted the sound on your content after a copyright claim",
  preheader: () => "Your video stays up without the claimed audio.",
  reference: (p) => `CLAIM ${p.claimId.slice(0, 8).toUpperCase()}`,
  blocks: (p) => [
    { type: "hero", eyebrow: "Audio muted", title: "Your video is still up, without the sound", tone: "neutral" },
    { type: "paragraph", text: `Hi ${p.firstName}, a rights holder showed they own the audio in ${p.contentLabel}. We replaced the soundtrack with silence and turned off reuse of this sound. Other clips using the same sound are muted too.` },
    claimDetails(p),
    { type: "callout", tone: "neutral", title: "No strike", text: p.reason },
    { type: "button", label: "View your content", href: p.contentUrl },
    counterNoticeRights(p),
  ],
  sample: sampleContent,
});

export const contentTakenDown = defineEmailTemplate<ContentProps & { readonly strikeAdded: boolean }>({
  ...base, key: "contentTakenDown", name: "Copyright content taken down", trigger: "copyrightClaim.contentTakenDown",
  subject: () => "We took down content that was claimed for copyright",
  preheader: (p) => (p.strikeAdded ? "A copyright strike was added to your account." : "It is no longer visible on Zudomart."),
  reference: (p) => `CLAIM ${p.claimId.slice(0, 8).toUpperCase()}`,
  blocks: (p) => [
    { type: "hero", eyebrow: "Content taken down", title: "This content is no longer visible", tone: "danger" },
    { type: "paragraph", text: `Hi ${p.firstName}, we took down ${p.contentLabel}. ${p.reason}` },
    claimDetails(p),
    ...(p.strikeAdded ? [{ type: "callout" as const, tone: "danger" as const, title: "Copyright strike added", text: "Strikes expire after 90 days. Several active strikes pause monetisation and going live." }] : []),
    { type: "button", label: "See your account status", href: p.accountStatusUrl },
    counterNoticeRights(p),
  ],
  sample: { ...sampleContent, strikeAdded: true },
});

export const strikeIssued = defineEmailTemplate<{ readonly firstName: string; readonly policy: string; readonly expiresAt: string; readonly activeStrikeCount: number; readonly threshold: number; readonly accountStatusUrl: string; readonly helpUrl: string }>({
  ...base, key: "strikeIssued", name: "Strike issued", trigger: "strike.issued",
  subject: () => "A strike was added to your Zudomart account",
  preheader: (p, c) => `It expires on ${c.date(p.expiresAt)}.`,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Account status", title: `You have ${p.activeStrikeCount} active ${p.activeStrikeCount === 1 ? "strike" : "strikes"}`, tone: p.activeStrikeCount >= p.threshold ? "danger" : "warn" },
    { type: "paragraph", text: `Hi ${p.firstName}, we added a strike to your account under our ${p.policy} rules.` },
    { type: "details", rows: [{ label: "Expires", value: c.date(p.expiresAt) }, { label: "Active strikes", value: `${p.activeStrikeCount} of ${p.threshold}` }] },
    { type: "paragraph", text: `At ${p.threshold} active strikes, monetisation and going live are paused and your account is reviewed for suspension.` },
    { type: "button", label: "Appeal or learn more", href: p.accountStatusUrl },
    { type: "links", items: [{ label: "How strikes work", href: p.helpUrl }] },
  ],
  sample: { firstName: "Tobi", policy: "copyright", expiresAt: "2027-01-02T09:00:00.000Z", activeStrikeCount: 1, threshold: 3, accountStatusUrl: sampleContent.accountStatusUrl, helpUrl: sampleContent.helpUrl },
});

export const strikeExpired = defineEmailTemplate<{ readonly firstName: string; readonly policy: string; readonly activeStrikeCount: number; readonly accountStatusUrl: string }>({
  ...base, key: "strikeExpired", name: "Strike expired", trigger: "strike.expired",
  subject: () => "A strike on your account has expired",
  preheader: (p) => (p.activeStrikeCount === 0 ? "Your account is back in good standing." : `You have ${p.activeStrikeCount} active left.`),
  blocks: (p) => [
    { type: "hero", eyebrow: "Account status", title: "A strike has expired", tone: "success" },
    { type: "paragraph", text: `Hi ${p.firstName}, a ${p.policy} strike on your account has expired and no longer counts against you.` },
    { type: "paragraph", text: p.activeStrikeCount === 0 ? "You have no active strikes." : `You still have ${p.activeStrikeCount} active ${p.activeStrikeCount === 1 ? "strike" : "strikes"}.` },
    { type: "button", label: "See your account status", href: p.accountStatusUrl },
  ],
  sample: { firstName: "Tobi", policy: "copyright", activeStrikeCount: 0, accountStatusUrl: sampleContent.accountStatusUrl },
});

export const counterNoticeReceived = defineEmailTemplate<{ readonly firstName: string; readonly claimId: string; readonly workTitle: string; readonly restoreEligibleAt: string; readonly helpUrl: string }>({
  ...base, key: "counterNoticeReceived", name: "Copyright counter-notice received", trigger: "copyrightClaim.counterNoticeReceived", audience: "Claimant",
  subject: () => "The uploader sent a counter-notice to your copyright claim",
  preheader: (p, c) => `The content may be restored after ${c.date(p.restoreEligibleAt)} unless you start court action.`,
  reference: (p) => `CLAIM ${p.claimId.slice(0, 8).toUpperCase()}`,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Counter-notice", title: "The uploader disputes your claim", tone: "neutral" },
    { type: "paragraph", text: `Hi ${p.firstName}, the uploader of the content you claimed for ${p.workTitle} says they have the right to use it.` },
    { type: "callout", tone: "neutral", title: `Restoration after ${c.date(p.restoreEligibleAt)}`, text: "If our team accepts the counter-notice, we restore the content after 10 business days unless you tell us you have filed court action against the uploader." },
    { type: "links", items: [{ label: "How counter-notices work", href: p.helpUrl }] },
  ],
  sample: { firstName: "Kaz", claimId: sampleContent.claimId, workTitle: sampleContent.workTitle, restoreEligibleAt: "2026-10-18T09:00:00.000Z", helpUrl: sampleContent.helpUrl },
});

export const contentRestored = defineEmailTemplate<ContentProps & { readonly audioOnly: boolean }>({
  ...base, key: "contentRestored", name: "Copyright content restored", trigger: "copyrightClaim.restored",
  subject: (p) => (p.audioOnly ? "The sound on your content is back" : "Your content has been restored"),
  preheader: () => "Your counter-notice stood and the waiting period passed.",
  reference: (p) => `CLAIM ${p.claimId.slice(0, 8).toUpperCase()}`,
  blocks: (p) => [
    { type: "hero", eyebrow: "Restored", title: p.audioOnly ? "The original sound is back" : "Your content is back up", tone: "success" },
    { type: "paragraph", text: `Hi ${p.firstName}, your counter-notice stood and the rights holder did not tell us about court action in time. We restored ${p.contentLabel} and removed any related strike or warning.` },
    { type: "button", label: "View your content", href: p.contentUrl },
  ],
  sample: { ...sampleContent, audioOnly: true },
});
