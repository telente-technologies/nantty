import { consentRules, defineEmailTemplate } from "./defineTemplate";

const base = { category: "privacy", kind: "legal", audience: "Account owner", consent: consentRules.legal } as const;

export interface PolicyUpdatedProps {
  readonly firstName: string;
  readonly policyName: string;
  readonly subjectLine?: string;
  readonly summary: string;
  readonly changes: readonly string[];
  readonly effectiveAt: string;
  readonly requiresReacceptance: boolean;
  readonly policyUrl: string;
  readonly acceptUrl?: string;
  readonly reacceptNote?: string;
}

export const dataExportReady = defineEmailTemplate<{ readonly firstName: string; readonly downloadUrl: string; readonly expiresAt: string; readonly sizeLabel: string; readonly requestedAt: string }>({
  ...base, key: "dataExportReady", name: "Data export ready", kind: "security", trigger: "privacy.export.completed", consent: consentRules.security,
  subject: () => "Your Zudomart data is ready to download",
  preheader: (p, c) => `The link expires ${c.dateTime(p.expiresAt)}.`,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Your data", title: "Your download is ready", tone: "success" },
    { type: "paragraph", text: `Hi ${p.firstName}, here's the copy of your data you asked for on ${c.date(p.requestedAt)}. It includes your profile, posts, orders, messages you sent and your privacy choices.` },
    { type: "button", label: `Download (${p.sizeLabel})`, href: p.downloadUrl },
    { type: "callout", tone: "warn", title: `Link expires ${c.dateTime(p.expiresAt)}`, text: "You'll need to sign in again to download. Don't forward this email — the file contains personal information." },
    { type: "paragraph", muted: true, text: "Didn't ask for this? Change your password and contact us straight away." },
  ],
  sample: { firstName: "Amaka", downloadUrl: "https://zudomart.com/privacy/exports/EXP-7781", expiresAt: "2026-10-10T09:00:00.000Z", sizeLabel: "184 MB", requestedAt: "2026-10-02T09:00:00.000Z" },
});

export const accountDeletionScheduled = defineEmailTemplate<{ readonly firstName: string; readonly deleteAt: string; readonly cancelUrl: string; readonly openOrders: number }>({
  ...base, key: "accountDeletionScheduled", name: "Account deletion scheduled", trigger: "privacy.deletion.scheduled",
  subject: (p, c) => `Your account will be deleted on ${c.date(p.deleteAt)}`,
  preheader: () => "Changed your mind? Cancel any time before then.",
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Account deletion", title: `Scheduled for ${c.date(p.deleteAt)}`, tone: "warn" },
    { type: "paragraph", text: `Hi ${p.firstName}, we've received your request to delete your account. Your account will be permanently deleted in 30 days, on ${c.date(p.deleteAt)}. Log in any time before then to cancel.` },
    { type: "list", title: "What gets deleted", items: ["Your profile, posts, clips, comments and saved items", "Messages you sent and chat media", "Followers, following and ZudoPoints"] },
    { type: "list", title: "What we keep, and why", items: ["Order, payment and tax records — anonymised and kept for the period the law requires", "Records needed to resolve open disputes or prevent fraud"] },
    ...(p.openOrders > 0 ? [{ type: "callout" as const, tone: "warn" as const, title: `${p.openOrders} open ${p.openOrders === 1 ? "order" : "orders"}`, text: "These will finish normally. Deletion waits until they're complete." }] : []),
    { type: "button", label: "Cancel deletion", href: p.cancelUrl },
  ],
  sample: { firstName: "Amaka", deleteAt: "2026-11-02T09:00:00.000Z", cancelUrl: "https://zudomart.com/settings/account/deletion/cancel", openOrders: 1 },
});

export const accountDeletionCompleted = defineEmailTemplate<{ readonly firstName: string; readonly deletedAt: string; readonly referenceId: string }>({
  ...base, key: "accountDeletionCompleted", name: "Account deletion completed", trigger: "privacy.deletion.completed",
  subject: () => "Your Zudomart account has been deleted",
  preheader: () => "This is the last email we'll send to this address.",
  reference: (p) => p.referenceId,
  reason: () => "We send this one final confirmation to the address that was on the account. You won't hear from us again.",
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Account deleted", title: `Goodbye, ${p.firstName}` },
    { type: "paragraph", text: `We deleted your account and personal data on ${c.date(p.deletedAt)}. Records we must keep by law are anonymised and no longer linked to you.` },
    { type: "details", rows: [{ label: "Deletion reference", value: p.referenceId, mono: true }] },
    { type: "paragraph", muted: true, text: "Keep this reference if you ever need to ask about this deletion. You're welcome back any time with a new account." },
  ],
  sample: { firstName: "Amaka", deletedAt: "2026-11-02T09:00:00.000Z", referenceId: "DEL-2026-11-0218" },
});

export const policyUpdated = defineEmailTemplate<PolicyUpdatedProps>({
  ...base, key: "policyUpdated", name: "Policy updated", trigger: "legal.policy_version.published (notice)",
  subject: (p, c) => p.subjectLine ?? `We're updating our ${p.policyName} on ${c.date(p.effectiveAt)}`,
  preheader: (p) => p.summary,
  blocks: (p, c) => [
    { type: "hero", eyebrow: p.requiresReacceptance ? "Action needed" : "Policy update", title: `Changes to our ${p.policyName}`, tone: p.requiresReacceptance ? "warn" : "brand" },
    { type: "paragraph", text: `Hi ${p.firstName}, ${p.summary}` },
    { type: "list", title: "What's changing", items: p.changes },
    { type: "details", rows: [{ label: "Policy", value: p.policyName }, { label: "Effective", value: c.date(p.effectiveAt), strong: true }] },
    ...(p.requiresReacceptance && p.acceptUrl
      ? [
          { type: "callout" as const, tone: "warn" as const, title: "Please review and accept", text: p.reacceptNote ?? `These are significant changes, so we need your agreement. You'll be asked to accept the next time you open Zudomart on or after ${c.date(p.effectiveAt)}.` },
          { type: "button" as const, label: "Review and accept", href: p.acceptUrl },
          { type: "links" as const, items: [{ label: `Read the full ${p.policyName}`, href: p.policyUrl }] },
        ]
      : [
          { type: "button" as const, label: `Read the full ${p.policyName}`, href: p.policyUrl },
          { type: "paragraph" as const, muted: true, text: `By using Zudomart on or after ${c.date(p.effectiveAt)}, you agree to the updated ${p.policyName}. If you don't agree, you can delete your account from settings.` },
        ]),
  ],
  sample: { firstName: "Amaka", policyName: "Privacy Policy", summary: "we've rewritten our Privacy Policy to be clearer about how we use your information to keep orders safe and personalise your feed.", changes: ["We explain how escrow and payment partners process your payment details.", "New section on how recommendations use what you watch and save, and how to turn it off.", "Retention periods are now listed per type of data.", "Clearer steps to download or delete your data."], effectiveAt: "2026-11-01T00:00:00.000Z", requiresReacceptance: true, policyUrl: "https://zudomart.com/legal/privacy", acceptUrl: "https://zudomart.com/legal/accept?doc=privacy" },
});

export const consentConfirmation = defineEmailTemplate<{ readonly firstName: string; readonly changes: readonly { readonly label: string; readonly granted: boolean }[]; readonly changedAt: string; readonly policyVersion: string }>({
  ...base, key: "consentConfirmation", name: "Consent confirmation", trigger: "privacy.consent.changed",
  subject: () => "Your privacy choices were updated",
  preheader: (p) => p.changes.map((change) => `${change.label}: ${change.granted ? "on" : "off"}`).join(" · "),
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Privacy choices", title: "We saved your choices", tone: "success" },
    { type: "details", title: `Changed ${c.dateTime(p.changedAt)}`, rows: [...p.changes.map((change) => ({ label: change.label, value: change.granted ? "On" : "Off", strong: true })), { label: "Policy version", value: p.policyVersion, mono: true }] },
    { type: "button", label: "Review privacy settings", href: c.url("/settings/privacy") },
    { type: "paragraph", muted: true, text: "We keep a record of each choice and the policy version you saw, as data protection law requires. Didn't make this change? Secure your account and contact us." },
  ],
  sample: { firstName: "Amaka", changes: [{ label: "Marketing emails", granted: true }, { label: "Personalised recommendations", granted: true }, { label: "Partner advertising", granted: false }], changedAt: "2026-10-03T10:15:00.000Z", policyVersion: "privacy-2026-11-01" },
});
