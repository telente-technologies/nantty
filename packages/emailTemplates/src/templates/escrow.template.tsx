import type { Money } from "../emailTypes";
import { ngn, sampleOrderGroups } from "../samples/sampleData";
import { consentRules, defineEmailTemplate } from "./defineTemplate";
import { buyerTrackSteps, disputeTrackSteps, orderTotal, type OrderProps } from "./orderHelpers";

const base = { category: "escrow", kind: "transactional", consent: consentRules.always } as const;
const orderRef = (p: { readonly orderNumber: string }) => `ORDER ${p.orderNumber}`;
const caseRef = (p: { readonly caseNumber: string }) => `CASE ${p.caseNumber}`;

interface DisputeProps {
  readonly firstName: string;
  readonly role: "buyer" | "seller";
  readonly caseNumber: string;
  readonly orderNumber: string;
  readonly caseUrl: string;
  readonly amount: Money;
}

const sampleDispute: DisputeProps = { firstName: "Amaka", role: "buyer", caseNumber: "DSP-10294", orderNumber: "ZM-48213", caseUrl: "https://nantty.com/disputes/DSP-10294", amount: ngn(62000) };

export const escrowFundsProtected = defineEmailTemplate<OrderProps & { readonly releaseRule: string }>({
  ...base, key: "escrowFundsProtected", name: "Funds protected in escrow", audience: "Buyer", trigger: "escrow.hold.created",
  subject: (p, c) => `${c.money(orderTotal(p.groups))} is protected in escrow`,
  preheader: () => "Sellers can withdraw only after you confirm delivery.",
  reference: orderRef,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Escrow", title: "Your payment is protected", tone: "success" },
    { type: "track", steps: ["Paid", "Held in escrow", "You confirm", "Seller paid"], current: 1 },
    { type: "paragraph", text: [`Hi ${p.firstName}, `, { strong: c.money(orderTotal(p.groups)) }, ` for order ${p.orderNumber} is held in escrow. ${p.releaseRule}`] },
    { type: "list", title: "How escrow protects you", items: [
      "Sellers can see you've paid, but can't withdraw the money yet.",
      "If an item never arrives, you get a full refund.",
      "If something's wrong, open a dispute within 3 days of delivery and payment stays frozen while we review.",
    ] },
    { type: "button", label: "View order", href: p.orderUrl },
    { type: "links", items: [{ label: "Learn how escrow works", href: c.url("/help/escrow") }] },
  ],
  sample: { firstName: "Amaka", orderNumber: "ZM-48213", orderUrl: "https://nantty.com/orders/ZM-48213", groups: sampleOrderGroups, releaseRule: "Each seller is paid separately once you confirm their part of the order." },
});

export const escrowAutoReleaseReminder = defineEmailTemplate<{ readonly firstName: string; readonly orderNumber: string; readonly sellerName: string; readonly amount: Money; readonly releaseAt: string; readonly confirmUrl: string; readonly disputeUrl: string }>({
  ...base, key: "escrowAutoReleaseReminder", name: "Auto-release reminder", audience: "Buyer", trigger: "escrow.release.reminder (24h before)",
  subject: (p) => `Payment to ${p.sellerName} releases tomorrow`,
  preheader: (p, c) => `Report any problem before ${c.dateTime(p.releaseAt)}.`,
  reference: orderRef,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Escrow reminder", title: "Payment releases in 24 hours", tone: "warn" },
    { type: "track", steps: buyerTrackSteps, current: 3, tone: "warn", caption: `Automatic release: ${c.dateTime(p.releaseAt)}` },
    { type: "paragraph", text: [`Hi ${p.firstName}, unless you report a problem, escrow releases `, { strong: c.money(p.amount) }, ` to ${p.sellerName} at ${c.dateTime(p.releaseAt)}. After that, the order can't be disputed.`] },
    { type: "button", label: "Confirm everything's fine", href: p.confirmUrl },
    { type: "links", items: [{ label: "Report a problem", href: p.disputeUrl }] },
  ],
  sample: { firstName: "Amaka", orderNumber: "ZM-48213", sellerName: "Adire Lagos Studio", amount: ngn(69000), releaseAt: "2026-10-09T14:20:00.000Z", confirmUrl: "https://nantty.com/orders/ZM-48213/confirm", disputeUrl: "https://nantty.com/orders/ZM-48213/dispute" },
});

export const escrowReleased = defineEmailTemplate<{ readonly firstName: string; readonly orderNumber: string; readonly gross: Money; readonly commission: Money; readonly paymentFee: Money; readonly net: Money; readonly availableAt: string; readonly releasedBecause: "confirmed" | "auto" | "dispute" }>({
  ...base, key: "escrowReleased", name: "Released to seller", audience: "Seller", trigger: "escrow.hold.released",
  subject: (p, c) => `${c.money(p.net)} released for order ${p.orderNumber}`,
  preheader: (p, c) => `Withdrawable from ${c.date(p.availableAt)}.`,
  reference: orderRef,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Escrow released", title: `You've been paid ${c.money(p.net)}`, tone: "success" },
    { type: "paragraph", text: `Hi ${p.firstName}, ${p.releasedBecause === "confirmed" ? "the buyer confirmed delivery" : p.releasedBecause === "auto" ? "the 3-day check window ended with no problems reported" : "the dispute was resolved in your favour"}, so escrow released the payment for order ${p.orderNumber}.` },
    { type: "totals", rows: [{ label: "Order value", amount: p.gross }, { label: "Nantty platform fee", amount: p.commission, credit: true }, { label: "Payment processing", amount: p.paymentFee, credit: true }], total: { label: "Released to your balance", amount: p.net } },
    { type: "callout", tone: "brand", text: ["Funds become available to withdraw on ", { strong: c.date(p.availableAt) }, " after the standard 24-hour lock. Payouts run daily."] },
    { type: "button", label: "Open your balance", href: `${c.brand.sellerDashboardUrl}/balance` },
  ],
  sample: { firstName: "Tobi", orderNumber: "ZM-48213", gross: ngn(66500), commission: ngn(3325), paymentFee: ngn(998), net: ngn(62177), availableAt: "2026-10-11T09:00:00.000Z", releasedBecause: "confirmed" },
});

export const disputeOpened = defineEmailTemplate<DisputeProps & { readonly reason: string; readonly respondBy: string; readonly openedBy: string }>({
  ...base, key: "disputeOpened", name: "Dispute opened", audience: "Buyer and seller", trigger: "escrow.dispute.opened",
  subject: (p) => (p.role === "buyer" ? `We've opened case ${p.caseNumber}` : `Action needed: a buyer reported a problem with order ${p.orderNumber}`),
  preheader: (p, c) => `${c.money(p.amount)} is frozen in escrow. Respond by ${c.dateTime(p.respondBy)}.`,
  reference: caseRef,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Dispute opened", title: p.role === "buyer" ? "We're on it. Your payment is frozen." : "A buyer opened a dispute", tone: p.role === "buyer" ? "brand" : "danger" },
    { type: "track", steps: disputeTrackSteps, current: 1, tone: "danger" },
    { type: "details", rows: [{ label: "Case", value: p.caseNumber, mono: true }, { label: "Order", value: p.orderNumber, mono: true }, { label: "Amount on hold", value: c.money(p.amount), strong: true }, { label: "Reason", value: p.reason }, { label: "Opened by", value: p.openedBy }] },
    { type: "paragraph", text: p.role === "buyer"
      ? `Add photos, videos or messages that show the problem by ${c.dateTime(p.respondBy)}. The seller can respond too, then a Nantty specialist reviews both sides.`
      : `Reply with your side and any proof — dispatch receipts, photos, chat history — by ${c.dateTime(p.respondBy)}. If you don't respond, the case may be decided for the buyer.` },
    { type: "button", label: p.role === "buyer" ? "Add evidence" : "Respond to the case", href: p.caseUrl, tone: p.role === "seller" ? "danger" : "brand" },
    { type: "paragraph", muted: true, text: "Keep all messages about this case inside Nantty. We can't consider deals made off the platform." },
  ],
  sample: { ...sampleDispute, reason: "Item not as described", respondBy: "2026-10-10T14:00:00.000Z", openedBy: "Buyer (@amaka.styles)" },
});

export const disputeUpdate = defineEmailTemplate<DisputeProps & { readonly update: string; readonly from: string; readonly stage: number; readonly actionNeededBy?: string }>({
  ...base, key: "disputeUpdate", name: "Dispute update", audience: "Buyer and seller", trigger: "escrow.dispute.updated",
  subject: (p) => `Update on case ${p.caseNumber}`,
  preheader: (p) => `${p.from} added an update.`,
  reference: caseRef,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Case update", title: p.actionNeededBy ? "We need something from you" : "There's news on your case", tone: p.actionNeededBy ? "warn" : "brand" },
    { type: "track", steps: disputeTrackSteps, current: p.stage, tone: "danger" },
    { type: "quote", author: p.from, text: p.update },
    ...(p.actionNeededBy ? [{ type: "callout" as const, tone: "warn" as const, title: "Reply by " + c.dateTime(p.actionNeededBy), text: "If we don't hear back, we'll decide using the information we already have." }] : []),
    { type: "button", label: "Open case", href: p.caseUrl },
  ],
  sample: { ...sampleDispute, from: "Nantty Resolution Team", update: "Thanks for the photos. Could you also share a short video showing the left ear cup not charging? That helps us confirm the fault quickly.", stage: 1, actionNeededBy: "2026-10-11T18:00:00.000Z" },
});

export const disputeResolved = defineEmailTemplate<DisputeProps & { readonly outcome: "refund_full" | "refund_partial" | "release_seller"; readonly buyerRefund: Money; readonly sellerPayout: Money; readonly summary: string }>({
  ...base, key: "disputeResolved", name: "Dispute resolved", audience: "Buyer and seller", trigger: "escrow.dispute.resolved",
  subject: (p) => `Case ${p.caseNumber} is resolved`,
  preheader: (p) => p.summary,
  reference: caseRef,
  blocks: (p, c) => {
    const title = p.outcome === "release_seller" ? "Payment released to the seller" : p.outcome === "refund_full" ? "Full refund to the buyer" : "Split decision: partial refund";
    return [
      { type: "hero", eyebrow: "Case resolved", title, tone: "success" },
      { type: "track", steps: disputeTrackSteps, current: 4 },
      { type: "paragraph", text: p.summary },
      { type: "details", title: "Decision", rows: [{ label: "Refund to buyer", value: c.money(p.buyerRefund), strong: p.role === "buyer" }, { label: "Paid to seller", value: c.money(p.sellerPayout), strong: p.role === "seller" }, { label: "Case", value: p.caseNumber, mono: true }] },
      { type: "paragraph", muted: true, text: "Think we got it wrong? You can ask for one review within 7 days from the case page. Decisions after review are final." },
      { type: "button", label: "View decision", href: p.caseUrl },
    ];
  },
  sample: { ...sampleDispute, outcome: "refund_full", buyerRefund: ngn(62000), sellerPayout: ngn(0), summary: "The headphones arrived with a faulty left ear cup and the seller agreed. We've refunded the full amount and the seller will arrange collection." },
});
