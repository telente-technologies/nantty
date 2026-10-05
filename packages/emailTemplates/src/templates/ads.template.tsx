import { consentRules, defineEmailTemplate } from "./defineTemplate";

const base = { category: "seller", kind: "transactional", audience: "Person invited to an ad account", consent: consentRules.always } as const;

const roleLabels: Readonly<Record<string, string>> = { admin: "Admin", advertiser: "Advertiser", analyst: "Analyst", billing: "Billing" };

export const adAccountInvite = defineEmailTemplate<{ readonly firstName: string; readonly accountName: string; readonly role: string; readonly invitedBy: string; readonly inviteUrl: string; readonly expiresAt: string }>({
  ...base, key: "adAccountInvite", name: "Ad account invite", trigger: "adInvite.created",
  subject: (p) => `${p.invitedBy} invited you to ${p.accountName} on Zudomart Ads`,
  preheader: (p) => `Join as ${roleLabels[p.role] ?? p.role}.`,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Zudomart Ads", title: `Join ${p.accountName}` },
    { type: "paragraph", text: [`Hi ${p.firstName}, `, { strong: p.invitedBy }, ` invited you to the ad account `, { strong: p.accountName }, ` as ${roleLabels[p.role] ?? p.role}.`] },
    { type: "button", label: "Review invite", href: p.inviteUrl },
    { type: "paragraph", muted: true, text: `The invite expires on ${c.dateTime(p.expiresAt)}. If you don't know ${p.invitedBy}, ignore this email and nothing changes.` },
  ],
  sample: { firstName: "Amaka", accountName: "Ada's Closet", role: "advertiser", invitedBy: "Adaeze Okafor", inviteUrl: "https://ads.zudomart.com/invites/7b9e2f3a-1111-4222-8333-123456789abc", expiresAt: "2026-10-12T09:00:00.000Z" },
});
