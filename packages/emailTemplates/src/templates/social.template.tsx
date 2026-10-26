import type { PersonCard } from "../emailTypes";
import { consentRules, defineEmailTemplate } from "./defineTemplate";

const base = { category: "social", kind: "transactional", audience: "Any user", consent: consentRules.transactionalOptOut } as const;
const socialReason = "You're getting this because social email notifications are on. Turn them off any time in notification settings.";

export const mentionedYou = defineEmailTemplate<{ readonly firstName: string; readonly actorName: string; readonly actorHandle: string; readonly where: "post" | "comment" | "clip" | "group chat"; readonly excerpt: string; readonly url: string }>({
  ...base, key: "mentionedYou", name: "Someone mentioned you", trigger: "social.mention.created (if not seen in app within 1h)",
  subject: (p) => `@${p.actorHandle} mentioned you in a ${p.where}`,
  preheader: (p) => p.excerpt.slice(0, 90),
  reason: () => socialReason,
  blocks: (p) => [
    { type: "hero", eyebrow: "Mention", title: `${p.actorName} mentioned you` },
    { type: "quote", author: `${p.actorName} @${p.actorHandle}`, meta: `in a ${p.where}`, text: p.excerpt },
    { type: "button", label: "View and reply", href: p.url },
    { type: "paragraph", muted: true, text: "Control who can mention you in Settings → Privacy → Mentions." },
  ],
  sample: { firstName: "Amaka", actorName: "Bola Ade", actorHandle: "bolaade", where: "comment", excerpt: "@amaka.styles this adire set would look perfect on you for the wedding next week", url: "https://nantty.com/p/8812#comment-41" },
});

export const followRequestDigest = defineEmailTemplate<{ readonly firstName: string; readonly requests: readonly PersonCard[]; readonly totalPending: number }>({
  ...base, key: "followRequestDigest", name: "New follower requests (digest)", trigger: "social.follow_request.digest (daily, private accounts)",
  subject: (p) => `${p.totalPending} people want to follow you`,
  preheader: (p) => p.requests.map((person) => person.name).slice(0, 3).join(", "),
  reason: () => socialReason,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Follow requests", title: `${p.totalPending} new follow ${p.totalPending === 1 ? "request" : "requests"}` },
    { type: "paragraph", text: `Hi ${p.firstName}, your account is private, so new followers need your approval.` },
    { type: "people", items: p.requests, more: p.totalPending > p.requests.length ? `and ${p.totalPending - p.requests.length} more` : undefined },
    { type: "button", label: "Review requests", href: c.url("/me/follow-requests") },
  ],
  sample: { firstName: "Amaka", totalPending: 7, requests: [{ name: "Chidi Okeke", handle: "chidi.o", note: "Followed by bolaade and 3 others" }, { name: "Zainab Musa", handle: "zainabm", note: "New to Nantty" }, { name: "Adire Lagos Studio", handle: "adirelagos", note: "Verified business" }] },
});

export const liveStarted = defineEmailTemplate<{ readonly firstName: string; readonly hostName: string; readonly hostHandle: string; readonly title: string; readonly viewerCount: number; readonly liveUrl: string; readonly isShopping: boolean }>({
  ...base, key: "liveStarted", name: "Live started by someone you follow (optional)", trigger: "live.stream.started (opt-in per creator)",
  subject: (p) => `${p.hostName} is live: ${p.title}`,
  preheader: (p) => `${p.viewerCount.toLocaleString("en")} watching now.`,
  reason: () => "You asked to get an email when this account goes live. Turn it off from their profile bell or notification settings.",
  blocks: (p) => [
    { type: "hero", eyebrow: "Live now", title: `${p.hostName} just went live`, tone: "danger" },
    { type: "quote", author: `${p.hostName} @${p.hostHandle}`, meta: `${p.viewerCount.toLocaleString("en")} watching`, text: p.title },
    { type: "button", label: "Join the live", href: p.liveUrl },
    ...(p.isShopping ? [{ type: "paragraph" as const, muted: true, text: "This is a shopping live. Products pinned during the stream are covered by escrow like any other order." }] : []),
  ],
  sample: { firstName: "Amaka", hostName: "Adire Lagos Studio", hostHandle: "adirelagos", title: "New indigo drop + 10% off for the first 50 orders", viewerCount: 1284, liveUrl: "https://nantty.com/live/adirelagos", isShopping: true },
});

export const messageRequestDigest = defineEmailTemplate<{ readonly firstName: string; readonly requests: readonly PersonCard[]; readonly totalPending: number }>({
  ...base, key: "messageRequestDigest", name: "Message request digest", trigger: "chat.message_request.digest (daily)",
  subject: (p) => `${p.totalPending} new message ${p.totalPending === 1 ? "request" : "requests"}`,
  preheader: () => "They can't see you've read their message until you accept.",
  reason: () => socialReason,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Message requests", title: "People want to chat with you" },
    { type: "paragraph", text: `Hi ${p.firstName}, these people messaged you but aren't in your chats yet. We don't show message previews in email to keep your chats private.` },
    { type: "people", items: p.requests, more: p.totalPending > p.requests.length ? `and ${p.totalPending - p.requests.length} more` : undefined },
    { type: "button", label: "Open message requests", href: c.url("/messages/requests") },
  ],
  sample: { firstName: "Amaka", totalPending: 3, requests: [{ name: "Gadget Hub NG", handle: "gadgethubng", note: "Verified business · about your order" }, { name: "Tunde Bakare", handle: "tbakare", note: "2 mutual followers" }] },
});
