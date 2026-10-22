import type { Money, SellerItemGroup } from "../emailTypes";
import { ngn, sampleOrderGroups } from "../samples/sampleData";
import { consentRules, defineEmailTemplate } from "./defineTemplate";
import { buyerTrackSteps, orderTotal, orderTotalsBlock, sellerCount, type OrderProps } from "./orderHelpers";

const base = { category: "orders", kind: "transactional", audience: "Buyer", consent: consentRules.always } as const;
const sampleOrder = { firstName: "Amaka", orderNumber: "ZM-48213", orderUrl: "https://zudomart.com/orders/ZM-48213", groups: sampleOrderGroups };
const firstGroup = sampleOrderGroups[0] as SellerItemGroup;
const ref = (p: { readonly orderNumber: string }) => `ORDER ${p.orderNumber}`;
const pendingRefundRows = (refundMethod: string | undefined) =>
  refundMethod
    ? [{ label: "Back to", value: refundMethod }, { label: "Arrives", value: "Within 3–5 business days" }]
    : [{ label: "Goes to", value: "Your Zudomart wallet, or your card if the payment hadn't settled yet" }, { label: "Arrives", value: "Wallet: straight away. Card: 3–5 business days" }];

export const orderPlaced = defineEmailTemplate<OrderProps & { readonly payBy: string; readonly paymentUrl: string }>({
  ...base, key: "orderPlaced", name: "Order placed", trigger: "commerce.order.placed",
  subject: (p) => `Order ${p.orderNumber} placed — complete your payment`,
  preheader: (p, c) => `Pay ${c.money(orderTotal(p.groups))} by ${c.dateTime(p.payBy)} to send it to ${sellerCount(p.groups)}.`,
  reference: ref,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Order placed", title: "Almost there — finish paying to confirm" },
    { type: "track", steps: buyerTrackSteps, current: 1, caption: `We're holding these items until ${c.dateTime(p.payBy)}.` },
    { type: "paragraph", text: `Hi ${p.firstName}, we've saved your order. Once you pay, your money is held in escrow — sellers can only withdraw it after you confirm delivery.` },
    { type: "button", label: `Pay ${c.money(orderTotal(p.groups))}`, href: p.paymentUrl },
    { type: "orderGroups", groups: p.groups },
    orderTotalsBlock(p.groups),
  ],
  sample: { ...sampleOrder, payBy: "2026-10-03T20:00:00.000Z", paymentUrl: "https://zudomart.com/checkout/pay/ZM-48213" },
});

export const paymentConfirmed = defineEmailTemplate<OrderProps & { readonly paymentMethod?: string; readonly paidAt: string }>({
  ...base, key: "paymentConfirmed", name: "Payment confirmed", trigger: "payments.charge.succeeded",
  subject: (p) => `Payment received for order ${p.orderNumber}`,
  preheader: (p, c) => `${c.money(orderTotal(p.groups))} is safe in escrow. ${sellerCount(p.groups)} can start packing.`,
  reference: ref,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Payment confirmed", title: "Paid and protected", tone: "success" },
    { type: "track", steps: buyerTrackSteps, current: 2, caption: "We'll email you at each step." },
    { type: "paragraph", text: [`Hi ${p.firstName}, we received `, { strong: c.money(orderTotal(p.groups)) }, p.paymentMethod === undefined ? ` on ${c.dateTime(p.paidAt)}. ` : ` by ${p.paymentMethod} on ${c.dateTime(p.paidAt)}. `, `It's held in escrow and only released once you confirm your order arrived.`] },
    { type: "orderGroups", groups: p.groups },
    orderTotalsBlock(p.groups, { totalLabel: "Paid" }),
    { type: "button", label: "Track your order", href: p.orderUrl },
  ],
  sample: { ...sampleOrder, paymentMethod: "Visa •••• 4242", paidAt: "2026-10-03T09:12:00.000Z" },
});

export const sellerAccepted = defineEmailTemplate<OrderProps & { readonly sellerName: string; readonly shipBy: string }>({
  ...base, key: "sellerAccepted", name: "Seller accepted order", trigger: "commerce.order.seller_accepted",
  subject: (p) => `${p.sellerName} accepted your order`,
  preheader: (p, c) => `They'll ship by ${c.date(p.shipBy)}.`,
  reference: ref,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Order accepted", title: `${p.sellerName} is packing your order`, tone: "success" },
    { type: "track", steps: buyerTrackSteps, current: 2, caption: `Expected to ship by ${c.date(p.shipBy)}.` },
    { type: "orderGroups", groups: p.groups.filter((group) => group.sellerName === p.sellerName) },
    { type: "button", label: "View order", href: p.orderUrl },
    { type: "paragraph", muted: true, text: "Your payment stays in escrow until you confirm delivery." },
  ],
  sample: { ...sampleOrder, sellerName: firstGroup.sellerName, shipBy: "2026-10-05T17:00:00.000Z" },
});

export const sellerRejected = defineEmailTemplate<OrderProps & { readonly sellerName: string; readonly reason: string; readonly refund: Money; readonly refundMethod?: string }>({
  ...base, key: "sellerRejected", name: "Seller declined order", trigger: "commerce.order.seller_rejected",
  subject: (p) => `${p.sellerName} couldn't fulfil part of your order`,
  preheader: (p, c) => `${c.money(p.refund)} is on its way back to you.`,
  reference: ref,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Order update", title: `${p.sellerName} declined these items`, tone: "warn" },
    { type: "paragraph", text: `Hi ${p.firstName}, ${p.sellerName} couldn't accept the items below. Items from other sellers in this order aren't affected.` },
    { type: "callout", tone: "neutral", title: "Reason from the seller", text: p.reason },
    { type: "orderGroups", groups: p.groups.filter((group) => group.sellerName === p.sellerName) },
    { type: "details", title: "Your refund", rows: [{ label: "Amount", value: c.money(p.refund), strong: true }, ...pendingRefundRows(p.refundMethod)] },
    { type: "button", label: "Find similar items", href: c.url("/search?similar=" + encodeURIComponent(p.orderNumber)) },
  ],
  sample: { ...sampleOrder, sellerName: firstGroup.sellerName, reason: "The indigo two-piece in size M sold out at our shop before we could update stock. Sorry!", refund: ngn(69000) },
});

export const orderShipped = defineEmailTemplate<OrderProps & { readonly sellerName: string; readonly carrier?: string; readonly trackingNumber?: string; readonly trackingUrl?: string; readonly estimatedDelivery?: string }>({
  ...base, key: "orderShipped", name: "Order shipped", trigger: "commerce.shipment.dispatched", consent: consentRules.transactionalOptOut,
  subject: (p) => `On its way: your order from ${p.sellerName}`,
  preheader: (p, c) => [p.carrier, p.estimatedDelivery === undefined ? undefined : `arriving by ${c.date(p.estimatedDelivery)}`].filter((part): part is string => part !== undefined).join(" · ") || "Your order is on its way.",
  reference: ref,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Shipped", title: p.estimatedDelivery === undefined ? "Your order is on its way" : `Arriving by ${c.date(p.estimatedDelivery)}` },
    { type: "track", steps: buyerTrackSteps, current: 3 },
    { type: "details", title: "Tracking", rows: [
      ...(p.carrier === undefined ? [] : [{ label: "Carrier", value: p.carrier }]),
      ...(p.trackingNumber === undefined ? [] : [{ label: "Tracking number", value: p.trackingNumber, mono: true }]),
      ...(p.estimatedDelivery === undefined ? [] : [{ label: "Estimated delivery", value: c.date(p.estimatedDelivery) }]),
    ] },
    ...(p.trackingUrl === undefined ? [] : [{ type: "button" as const, label: "Track package", href: p.trackingUrl }]),
    { type: "orderGroups", groups: p.groups.filter((group) => group.sellerName === p.sellerName) },
    { type: "paragraph", muted: true, text: "Check your items when they arrive. You'll have 3 days to confirm or report a problem before payment is released." },
  ],
  sample: { ...sampleOrder, sellerName: firstGroup.sellerName, carrier: "GIG Logistics", trackingNumber: "GIG-7782-1190-NG", trackingUrl: "https://zudomart.com/orders/ZM-48213/tracking", estimatedDelivery: "2026-10-07T12:00:00.000Z" },
});

export const orderDelivered = defineEmailTemplate<OrderProps & { readonly sellerName: string; readonly deliveredAt: string; readonly confirmBy: string; readonly confirmUrl: string; readonly disputeUrl: string }>({
  ...base, key: "orderDelivered", name: "Order delivered", trigger: "commerce.shipment.delivered",
  subject: (p) => `Delivered: is everything right with your ${p.sellerName} order?`,
  preheader: (p, c) => `Confirm or report a problem by ${c.dateTime(p.confirmBy)}.`,
  reference: ref,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Delivered", title: "Your order arrived. Is it all there?", tone: "success" },
    { type: "track", steps: buyerTrackSteps, current: 3, caption: `Delivered ${c.dateTime(p.deliveredAt)}.` },
    { type: "callout", tone: "warn", title: "You have 3 days to check your items", text: ["If you don't confirm or open a dispute by ", { strong: c.dateTime(p.confirmBy) }, `, we'll release payment to ${p.sellerName} automatically.`] },
    { type: "button", label: "Everything's fine — confirm", href: p.confirmUrl },
    { type: "links", items: [{ label: "Something's wrong — report a problem", href: p.disputeUrl }] },
    { type: "orderGroups", groups: p.groups.filter((group) => group.sellerName === p.sellerName) },
  ],
  sample: { ...sampleOrder, sellerName: firstGroup.sellerName, deliveredAt: "2026-10-06T14:20:00.000Z", confirmBy: "2026-10-09T14:20:00.000Z", confirmUrl: "https://zudomart.com/orders/ZM-48213/confirm", disputeUrl: "https://zudomart.com/orders/ZM-48213/dispute" },
});

export const orderCompleted = defineEmailTemplate<OrderProps & { readonly sellerName: string; readonly reviewUrl: string }>({
  ...base, key: "orderCompleted", name: "Order completed", trigger: "commerce.order.completed", consent: consentRules.transactionalOptOut,
  subject: (p) => `Order complete — how was ${p.sellerName}?`,
  preheader: () => "Payment has been released. Leave a review to help other shoppers.",
  reference: ref,
  blocks: (p) => [
    { type: "hero", eyebrow: "Complete", title: "All done. Enjoy your order!", tone: "success" },
    { type: "track", steps: buyerTrackSteps, current: 5 },
    { type: "paragraph", text: `Hi ${p.firstName}, payment has been released to ${p.sellerName} and this order is closed. Thanks for shopping safely with escrow.` },
    { type: "button", label: `Review ${p.sellerName}`, href: p.reviewUrl },
    { type: "paragraph", muted: true, text: "Reviews are public and help other buyers shop with confidence. Problem later? Sellers' return policies still apply — reach them from your order page." },
  ],
  sample: { ...sampleOrder, sellerName: firstGroup.sellerName, reviewUrl: "https://zudomart.com/orders/ZM-48213/review" },
});

export const orderCancelled = defineEmailTemplate<OrderProps & { readonly cancelledBy: "you" | "seller" | "zudomart"; readonly reason: string; readonly refund: Money | null; readonly refundMethod?: string }>({
  ...base, key: "orderCancelled", name: "Order cancelled", trigger: "commerce.order.cancelled",
  subject: (p) => `Order ${p.orderNumber} was cancelled`,
  preheader: (p, c) => (p.refund ? `${c.money(p.refund)} is being refunded.` : "You weren't charged."),
  reference: ref,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Cancelled", title: "Your order was cancelled", tone: "danger" },
    { type: "paragraph", text: `Hi ${p.firstName}, order ${p.orderNumber} was cancelled ${p.cancelledBy === "you" ? "at your request" : p.cancelledBy === "seller" ? "by the seller" : "by Zudomart"}.` },
    { type: "callout", tone: "neutral", title: "Reason", text: p.reason },
    p.refund
      ? { type: "details", title: "Refund", rows: [{ label: "Amount", value: c.money(p.refund), strong: true }, ...pendingRefundRows(p.refundMethod)] }
      : { type: "paragraph", text: "You weren't charged for this order." },
    { type: "orderGroups", groups: p.groups },
    { type: "button", label: "Continue shopping", href: c.url("/") },
  ],
  sample: { ...sampleOrder, cancelledBy: "you", reason: "You cancelled before the sellers shipped.", refund: ngn(131000) },
});

export const refundIssued = defineEmailTemplate<{ readonly firstName: string; readonly orderNumber: string; readonly refund: Money; readonly refundDestination: "wallet" | "paymentMethod"; readonly refundMethod: string; readonly reference: string; readonly reason: string; readonly itemName: string }>({
  ...base, key: "refundIssued", name: "Refund issued", trigger: "payments.refund.succeeded",
  subject: (p, c) => (p.refundDestination === "wallet" ? `Your ${c.money(p.refund)} refund is in your Zudomart wallet` : `Your ${c.money(p.refund)} refund is on its way`),
  preheader: (p) => (p.refundDestination === "wallet" ? "It's back in your Zudomart wallet now." : `Back to ${p.refundMethod} in 3–5 business days.`),
  reference: ref,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Refund issued", title: p.refundDestination === "wallet" ? `${c.money(p.refund)} is back in your wallet` : `${c.money(p.refund)} is on its way back`, tone: "success" },
    { type: "paragraph", text: `Hi ${p.firstName}, we've refunded you for ${p.itemName}. ${p.reason}` },
    { type: "details", rows: [{ label: "Refund", value: c.money(p.refund), strong: true }, { label: "Back to", value: p.refundMethod }, { label: "Arrives", value: p.refundDestination === "wallet" ? "Now" : "3–5 business days, depending on your bank" }, { label: "Reference", value: p.reference, mono: true }] },
    p.refundDestination === "wallet"
      ? { type: "paragraph", muted: true, text: "You can spend it on Zudomart or withdraw it to your bank from your wallet." }
      : { type: "paragraph", muted: true, text: "Card and bank refunds can take a few days to show on your statement. If you need to ask your bank, give them the reference above." },
    { type: "button", label: "View order", href: c.url(`/orders/${p.orderNumber}`) },
  ],
  sample: { firstName: "Amaka", orderNumber: "ZM-48213", refund: ngn(62000), refundDestination: "wallet", refundMethod: "Your Zudomart wallet", reference: "RF-20261003-8841", reason: "Your dispute was resolved in your favour.", itemName: "Wireless over-ear headphones" },
});
