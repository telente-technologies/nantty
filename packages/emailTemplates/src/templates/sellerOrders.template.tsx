import type { Money, SellerItemGroup } from "../emailTypes";
import { ngn, sampleImages, sampleOrderGroups } from "../samples/sampleData";
import { consentRules, defineEmailTemplate } from "./defineTemplate";
import { orderTotal } from "./orderHelpers";

const base = { category: "seller", kind: "transactional", audience: "Seller", consent: consentRules.always } as const;
const sampleGroup = sampleOrderGroups[0] as SellerItemGroup;
const dash = (root: string, path: string) => `${root}${path}`;

interface PayoutProps {
  readonly firstName: string;
  readonly payoutId: string;
  readonly amount: Money;
  readonly bankAccount: string;
}

const samplePayout: PayoutProps = { firstName: "Tobi", payoutId: "PO-2026-10-03-0192", amount: ngn(248300), bankAccount: "GTBank •••• 0412" };

export const sellerNewOrder = defineEmailTemplate<{ readonly firstName: string; readonly orderNumber: string; readonly buyerName: string; readonly group: SellerItemGroup; readonly acceptBy?: string; readonly paymentMode: "escrow" | "direct" }>({
  ...base, key: "sellerNewOrder", name: "New order", trigger: "commerce.order.paid (per seller group)",
  subject: (p, c) => `New order ${p.orderNumber} — ${c.money(orderTotal([p.group]))}`,
  preheader: (p, c) => p.acceptBy === undefined ? "Open your dashboard to accept and prepare it." : `Accept by ${c.dateTime(p.acceptBy)} or it will be cancelled automatically.`,
  reference: (p) => `ORDER ${p.orderNumber}`,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "New order", title: `${p.buyerName} just bought from you`, tone: "success" },
    { type: "paragraph", text: p.acceptBy === undefined
      ? `Payment is confirmed${p.paymentMode === "escrow" ? " and held in escrow" : ""}. Accept the order in your dashboard and ship it within your stated handling time.`
      : ["Payment is confirmed", p.paymentMode === "escrow" ? " and held in escrow" : "", ". Accept the order by ", { strong: c.dateTime(p.acceptBy) }, " and ship it within your stated handling time."] },
    { type: "orderGroups", groups: [p.group] },
    { type: "button", label: "Accept and prepare order", href: dash(c.brand.sellerDashboardUrl, `/orders/${p.orderNumber}`) },
    { type: "paragraph", muted: true, text: p.paymentMode === "escrow" ? "Escrow releases 3 days after delivery unless the buyer reports a problem. Then funds lock for 24 hours before you can withdraw." : "This buyer chose direct payment. Funds lock for 24 hours before you can withdraw." },
  ],
  sample: { firstName: "Tobi", orderNumber: "ZM-48213", buyerName: "Amaka O.", group: sampleGroup, acceptBy: "2026-10-05T09:12:00.000Z", paymentMode: "escrow" },
});

export const sellerOrderCancelled = defineEmailTemplate<{ readonly firstName: string; readonly orderNumber: string; readonly cancelledBy: "buyer" | "system" | "zudomart"; readonly reason: string; readonly group: SellerItemGroup; readonly restocked: boolean }>({
  ...base, key: "sellerOrderCancelled", name: "Seller order cancelled", trigger: "commerce.order.cancelled (per seller group)",
  subject: (p) => `Order ${p.orderNumber} was cancelled — don't ship it`,
  preheader: (p) => p.reason,
  reference: (p) => `ORDER ${p.orderNumber}`,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Order cancelled", title: "Stop — don't ship this order", tone: "danger" },
    { type: "paragraph", text: `Hi ${p.firstName}, order ${p.orderNumber} was cancelled ${p.cancelledBy === "buyer" ? "by the buyer before dispatch" : p.cancelledBy === "system" ? "automatically because it wasn't accepted in time" : "by Zudomart"}. The buyer has been refunded.` },
    { type: "callout", tone: "neutral", title: "Reason", text: p.reason },
    { type: "orderGroups", groups: [p.group] },
    { type: "paragraph", text: p.restocked ? "We've put the stock back on your listings." : "Stock wasn't restored automatically. Update your inventory if the items are still available." },
    { type: "button", label: "View order", href: dash(c.brand.sellerDashboardUrl, `/orders/${p.orderNumber}`) },
  ],
  sample: { firstName: "Tobi", orderNumber: "ZM-48213", cancelledBy: "buyer", reason: "Buyer ordered the wrong size and cancelled within the free cancellation window.", group: sampleGroup, restocked: true },
});

export const sellerLowStock = defineEmailTemplate<{ readonly firstName: string; readonly items: readonly { readonly name: string; readonly variant: string; readonly remaining: number; readonly imageUrl: string; readonly price: Money }[] }>({
  ...base, key: "sellerLowStock", name: "Low stock", trigger: "catalog.inventory.below_threshold (daily digest)", consent: consentRules.transactionalOptOut,
  subject: (p) => `${p.items.length} ${p.items.length === 1 ? "listing is" : "listings are"} running low`,
  preheader: (p) => p.items.map((item) => `${item.name}: ${item.remaining} left`).join(" · "),
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Inventory", title: "Restock before you sell out", tone: "warn" },
    { type: "paragraph", text: `Hi ${p.firstName}, these listings dropped below your low-stock alert. Sold-out listings stop showing in search and live shopping.` },
    { type: "orderGroups", groups: [{ sellerName: "Your store", items: p.items.map((item) => ({ name: item.name, variant: `${item.variant} · ${item.remaining} left`, quantity: 1, unitPrice: item.price, imageUrl: item.imageUrl })), shipping: ngn(0), status: "Low stock" }] },
    { type: "button", label: "Update inventory", href: dash(c.brand.sellerDashboardUrl, "/products?filter=low-stock") },
  ],
  sample: { firstName: "Tobi", items: [{ name: "Leather slide sandals", variant: "Tan · 42", remaining: 2, imageUrl: sampleImages.sneakers, price: ngn(14000) }, { name: "Everyday leather tote", variant: "Black", remaining: 1, imageUrl: sampleImages.bag, price: ngn(52000) }] },
});

export const payoutScheduled = defineEmailTemplate<PayoutProps & { readonly scheduledFor: string; readonly orderCount: number }>({
  ...base, key: "payoutScheduled", name: "Payout scheduled", trigger: "money.payout.scheduled", consent: consentRules.transactionalOptOut,
  subject: (p, c) => `${c.money(p.amount)} payout scheduled for ${c.date(p.scheduledFor)}`,
  preheader: (p) => `Going to ${p.bankAccount}.`,
  reference: (p) => p.payoutId,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Payout scheduled", title: `${c.money(p.amount)} is on the next payout run` },
    { type: "track", steps: ["In escrow", "Locked 24h", "Available", "Payout sent"], current: 3 },
    { type: "details", rows: [{ label: "Amount", value: c.money(p.amount), strong: true }, { label: "To", value: p.bankAccount }, { label: "Scheduled for", value: c.date(p.scheduledFor) }, { label: "From", value: `${p.orderCount} completed orders` }, { label: "Payout ID", value: p.payoutId, mono: true }] },
    { type: "button", label: "View payout", href: dash(c.brand.sellerDashboardUrl, `/payouts/${p.payoutId}`) },
  ],
  sample: { ...samplePayout, scheduledFor: "2026-10-04T08:00:00.000Z", orderCount: 7 },
});

export const payoutSent = defineEmailTemplate<PayoutProps & { readonly sentAt: string; readonly bankReference: string }>({
  ...base, key: "payoutSent", name: "Payout sent", trigger: "money.payout.paid",
  subject: (p, c) => `${c.money(p.amount)} sent to ${p.bankAccount}`,
  preheader: () => "Most banks show it within a few hours.",
  reference: (p) => p.payoutId,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Payout sent", title: `${c.money(p.amount)} is on its way to your bank`, tone: "success" },
    { type: "track", steps: ["In escrow", "Locked 24h", "Available", "Payout sent"], current: 4 },
    { type: "details", rows: [{ label: "Amount", value: c.money(p.amount), strong: true }, { label: "To", value: p.bankAccount }, { label: "Sent", value: c.dateTime(p.sentAt) }, { label: "Bank reference", value: p.bankReference, mono: true }, { label: "Payout ID", value: p.payoutId, mono: true }] },
    { type: "paragraph", muted: true, text: "Not in your account after 24 hours? Share the bank reference with your bank first, then contact us." },
    { type: "button", label: "Download statement", href: dash(c.brand.sellerDashboardUrl, `/payouts/${p.payoutId}/statement`) },
  ],
  sample: { ...samplePayout, sentAt: "2026-10-04T08:14:00.000Z", bankReference: "NIP-000013261004081400192" },
});

export const payoutFailed = defineEmailTemplate<PayoutProps & { readonly reason: string; readonly retryAt?: string }>({
  ...base, key: "payoutFailed", name: "Payout failed", trigger: "money.payout.failed",
  subject: (p, c) => `Action needed: your ${c.money(p.amount)} payout didn't go through`,
  preheader: (p) => p.reason,
  reference: (p) => p.payoutId,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Payout failed", title: "We couldn't send your payout", tone: "danger" },
    { type: "paragraph", text: [`Hi ${p.firstName}, your bank returned the payout of `, { strong: c.money(p.amount) }, ` to ${p.bankAccount}. The money is safe in your available balance.`] },
    { type: "callout", tone: "danger", title: "What went wrong", text: p.reason },
    { type: "button", label: "Check payout details", href: dash(c.brand.sellerDashboardUrl, "/settings/payouts"), tone: "danger" },
    { type: "paragraph", muted: true, text: p.retryAt ? `We'll try again automatically on ${c.date(p.retryAt)} once your details are fixed.` : "Once you update your details, we'll include this amount in the next daily payout run." },
  ],
  sample: { ...samplePayout, reason: "The account name at your bank doesn't match the verified business name on your store.", retryAt: "2026-10-05T08:00:00.000Z" },
});

export const sellerFundsLocked = defineEmailTemplate<{ readonly firstName: string; readonly amount: Money; readonly orderNumber: string; readonly availableAt: string }>({
  ...base, key: "sellerFundsLocked", name: "Funds locked", trigger: "money.balance.locked", consent: consentRules.transactionalOptOut,
  subject: (p, c) => `${c.money(p.amount)} is locked until ${c.date(p.availableAt)}`,
  preheader: () => "Every payment rests for 24 hours before it can be withdrawn.",
  reference: (p) => `ORDER ${p.orderNumber}`,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Balance", title: "Funds locked for 24 hours" },
    { type: "track", steps: ["In escrow", "Locked 24h", "Available", "Payout sent"], current: 1, caption: `Unlocks ${c.dateTime(p.availableAt)}` },
    { type: "paragraph", text: [`Hi ${p.firstName}, `, { strong: c.money(p.amount) }, ` from order ${p.orderNumber} has left escrow. It rests for 24 hours to protect against chargebacks, then becomes available.`] },
    { type: "button", label: "View balance", href: dash(c.brand.sellerDashboardUrl, "/balance") },
  ],
  sample: { firstName: "Tobi", amount: ngn(62177), orderNumber: "ZM-48213", availableAt: "2026-10-10T14:20:00.000Z" },
});

export const sellerFundsAvailable = defineEmailTemplate<{ readonly firstName: string; readonly amount: Money; readonly availableBalance: Money }>({
  ...base, key: "sellerFundsAvailable", name: "Funds available", trigger: "money.balance.available", consent: consentRules.transactionalOptOut,
  subject: (p, c) => `${c.money(p.amount)} is ready to withdraw`,
  preheader: (p, c) => `Available balance: ${c.money(p.availableBalance)}.`,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Balance", title: `${c.money(p.amount)} just became available`, tone: "success" },
    { type: "track", steps: ["In escrow", "Locked 24h", "Available", "Payout sent"], current: 2 },
    { type: "details", rows: [{ label: "Newly available", value: c.money(p.amount) }, { label: "Available balance", value: c.money(p.availableBalance), strong: true }] },
    { type: "button", label: "Withdraw now", href: dash(c.brand.sellerDashboardUrl, "/balance/withdraw") },
    { type: "paragraph", muted: true, text: "Don't want to withdraw by hand? Turn on automatic daily payouts in payout settings." },
  ],
  sample: { firstName: "Tobi", amount: ngn(62177), availableBalance: ngn(248300) },
});
