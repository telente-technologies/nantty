import type { Money } from "../emailTypes";
import { ngn, sampleOrderGroups } from "../samples/sampleData";
import { consentRules, defineEmailTemplate } from "./defineTemplate";
import { orderTotal, orderTotalsBlock, type OrderProps } from "./orderHelpers";

const base = { category: "payments", kind: "transactional", audience: "Buyer", consent: consentRules.always } as const;
const sumMoney = (first: Money, ...rest: readonly Money[]): Money => ({ ...first, amountMinor: rest.reduce((sum, item) => sum + item.amountMinor, first.amountMinor) });

interface ReceiptMeta {
  readonly receiptNumber: string;
  readonly paidAt: string;
  readonly paymentMethod: string;
}

export const paymentReceipt = defineEmailTemplate<OrderProps & ReceiptMeta & { readonly discount?: Money }>({
  ...base, key: "paymentReceipt", name: "Payment receipt (products)", trigger: "payments.charge.succeeded (receipt)",
  subject: (p, c) => `Your Nantty receipt — ${c.money(orderTotal(p.groups, p.discount))}`,
  preheader: (p) => `Order ${p.orderNumber} · ${p.paymentMethod}`,
  reference: (p) => p.receiptNumber,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Receipt", title: `${c.money(orderTotal(p.groups, p.discount))} paid`, tone: "success" },
    { type: "details", rows: [{ label: "Receipt", value: p.receiptNumber, mono: true }, { label: "Order", value: p.orderNumber, mono: true }, { label: "Paid on", value: c.dateTime(p.paidAt) }, { label: "Payment method", value: p.paymentMethod }] },
    { type: "orderGroups", groups: p.groups },
    orderTotalsBlock(p.groups, { discount: p.discount, totalLabel: "Total paid" }),
    { type: "paragraph", muted: true, text: "Each seller is paid through their own Nantty seller account. Your payment for each seller stays in escrow until you confirm that part of the order." },
    { type: "button", label: "View order", href: p.orderUrl },
  ],
  sample: { firstName: "Amaka", orderNumber: "ZM-48213", orderUrl: "https://nantty.com/orders/ZM-48213", groups: sampleOrderGroups, receiptNumber: "RC-20261003-55120", paidAt: "2026-10-03T09:12:00.000Z", paymentMethod: "Visa •••• 4242", discount: ngn(5000) },
});

export const coinPurchaseReceipt = defineEmailTemplate<ReceiptMeta & { readonly firstName: string; readonly packName: string; readonly coins: number; readonly bonusCoins: number; readonly price: Money; readonly balanceAfter: number }>({
  ...base, key: "coinPurchaseReceipt", name: "Coin purchase receipt (web)", trigger: "coins.purchase.succeeded (web)",
  subject: (p) => `${(p.coins + p.bonusCoins).toLocaleString("en")} coins added to your account`,
  preheader: (p, c) => `${p.packName} · ${c.money(p.price)}`,
  reference: (p) => p.receiptNumber,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Coins", title: `${(p.coins + p.bonusCoins).toLocaleString("en")} coins are ready to gift`, tone: "success" },
    { type: "details", title: "Receipt", rows: [{ label: "Pack", value: p.packName }, { label: "Coins", value: p.coins.toLocaleString("en") }, { label: "Web bonus", value: `+${p.bonusCoins.toLocaleString("en")}` }, { label: "Paid", value: c.money(p.price), strong: true }, { label: "Payment method", value: p.paymentMethod }, { label: "Date", value: c.dateTime(p.paidAt) }, { label: "Receipt", value: p.receiptNumber, mono: true }, { label: "New balance", value: `${p.balanceAfter.toLocaleString("en")} coins` }] },
    { type: "paragraph", muted: true, text: "Coins are for gifts in lives and on posts. They aren't money, can't be withdrawn and don't expire while your account is active." },
    { type: "button", label: "Watch live now", href: c.url("/live") },
  ],
  sample: { firstName: "Amaka", packName: "Starter pack", coins: 1000, bonusCoins: 150, price: ngn(2000), balanceAfter: 1840, receiptNumber: "RC-COIN-77120", paidAt: "2026-10-03T19:40:00.000Z", paymentMethod: "Verve •••• 1180" },
});

export const subscriptionReceipt = defineEmailTemplate<ReceiptMeta & { readonly firstName: string; readonly product: "Blue checkmark" | "Gold checkmark" | "Black checkmark" | "Nantty Premium"; readonly price: Money; readonly vat: Money; readonly interval: "month" | "year"; readonly periodEnd: string; readonly discountLabel?: string; readonly discount?: Money }>({
  ...base, key: "subscriptionReceipt", name: "Subscription receipt (Blue/Gold/Black/Premium)", audience: "Subscriber", trigger: "billing.subscription.invoice_paid",
  subject: (p) => `Receipt for ${p.product}`,
  preheader: (p, c) => `Renews ${c.date(p.periodEnd)}.`,
  reference: (p) => p.receiptNumber,
  blocks: (p, c) => {
    const total = sumMoney(p.price, p.vat, ...(p.discount ? [{ ...p.discount, amountMinor: -p.discount.amountMinor }] : []));
    return [
      { type: "hero", eyebrow: "Subscription", title: `${p.product} is active`, tone: "success" },
      { type: "totals", rows: [{ label: `${p.product} (${p.interval}ly)`, amount: p.price }, ...(p.discount ? [{ label: p.discountLabel ?? "Discount", amount: p.discount, credit: true }] : []), { label: "VAT (7.5%)", amount: p.vat }], total: { label: "Total paid", amount: total } },
      { type: "details", rows: [{ label: "Receipt", value: p.receiptNumber, mono: true }, { label: "Paid with", value: p.paymentMethod }, { label: "Paid on", value: c.dateTime(p.paidAt) }, { label: "Renews", value: c.date(p.periodEnd) }] },
      { type: "button", label: "Manage subscription", href: c.url("/settings/subscriptions") },
      { type: "paragraph", muted: true, text: "Cancel any time; you keep access until the end of the period you've paid for." },
    ];
  },
  sample: { firstName: "Amaka", product: "Blue checkmark", price: ngn(2500), vat: ngn(187.5), interval: "month", periodEnd: "2026-11-03T09:00:00.000Z", receiptNumber: "RC-SUB-30114", paidAt: "2026-10-03T09:00:00.000Z", paymentMethod: "Visa •••• 4242" },
});

export const paymentFailed = defineEmailTemplate<{ readonly firstName: string; readonly description: string; readonly amount: Money; readonly paymentMethod: string; readonly reason: string; readonly retryUrl: string; readonly holdUntil?: string }>({
  ...base, key: "paymentFailed", name: "Payment failed", trigger: "payments.charge.failed",
  subject: () => "Your payment didn't go through",
  preheader: (p, c) => `${c.money(p.amount)} for ${p.description}. You weren't charged.`,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Payment failed", title: "We couldn't take your payment", tone: "danger" },
    { type: "paragraph", text: [`Hi ${p.firstName}, your payment of `, { strong: c.money(p.amount) }, ` for ${p.description} with ${p.paymentMethod} was declined. You haven't been charged.`] },
    { type: "callout", tone: "danger", title: "Reason", text: p.reason },
    { type: "button", label: "Try again", href: p.retryUrl },
    { type: "paragraph", muted: true, text: p.holdUntil ? `We'll keep your items reserved until ${c.dateTime(p.holdUntil)}.` : "Try a different card, or check with your bank that online payments are turned on." },
  ],
  sample: { firstName: "Amaka", description: "order ZM-48213", amount: ngn(131000), paymentMethod: "Visa •••• 4242", reason: "Your bank declined the payment. This often happens when online or international payments are turned off.", retryUrl: "https://nantty.com/checkout/pay/ZM-48213", holdUntil: "2026-10-03T20:00:00.000Z" },
});

export const cardVerificationRefunded = defineEmailTemplate<{ readonly firstName: string; readonly amount: Money; readonly cardLabel: string; readonly reason: string; readonly reference: string }>({
  ...base, key: "cardVerificationRefunded", name: "Card verification charge refunded", audience: "Any user starting a trial", trigger: "billing.card_verification.refunded",
  subject: (p, c) => `We refunded the ${c.money(p.amount)} card check`,
  preheader: (p) => `It was only to confirm ${p.cardLabel} works.`,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Refund", title: "Card check refunded", tone: "success" },
    { type: "paragraph", text: `Hi ${p.firstName}, to start your ${p.reason}, we made a small charge to confirm your card is real. We've refunded it in full.` },
    { type: "details", rows: [{ label: "Amount", value: c.money(p.amount) }, { label: "Card", value: p.cardLabel }, { label: "Reference", value: p.reference, mono: true }] },
    { type: "paragraph", muted: true, text: "Some banks show the refund as a separate line, and it can take up to 5 business days to disappear from pending." },
  ],
  sample: { firstName: "Tobi", amount: ngn(50), cardLabel: "Mastercard •••• 5521", reason: "Pro plan free trial", reference: "CV-20261003-1182" },
});
