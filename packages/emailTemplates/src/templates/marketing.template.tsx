import type { Money, ProductCard } from "../emailTypes";
import { ngn, sampleProducts } from "../samples/sampleData";
import { consentRules, defineEmailTemplate } from "./defineTemplate";

export type VerifiedProduct = ProductCard & { readonly sellerVerified: true };

const base = { category: "marketing", kind: "marketing", audience: "Users with marketing consent", consent: consentRules.marketing } as const;
const verified = (items: readonly ProductCard[]): VerifiedProduct[] => items.map((item) => ({ ...item, sellerVerified: true }));
const sampleVerified = verified(sampleProducts);
const firstProduct = sampleVerified[0] as VerifiedProduct;
const onlyVerified = (items: readonly VerifiedProduct[]) => items.filter((item) => item.sellerVerified === true);

export const pickedForYou = defineEmailTemplate<{ readonly firstName: string; readonly basedOn: string; readonly products: readonly VerifiedProduct[] }>({
  ...base, key: "pickedForYou", name: "Picked for you", trigger: "marketing.recommendations.weekly",
  subject: (p) => `${p.firstName}, we picked these for you`,
  preheader: (p) => `Because you liked ${p.basedOn}. All from verified sellers.`,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Picked for you", title: "Things we think you'll love" },
    { type: "paragraph", text: `Based on ${p.basedOn}. Every item here comes from a verified seller and is covered by escrow.` },
    { type: "products", items: onlyVerified(p.products) },
    { type: "button", label: "See more picks", href: c.url("/for-you") },
  ],
  sample: { firstName: "Amaka", basedOn: "adire fashion and leather accessories", products: sampleVerified },
});

export const priceDrop = defineEmailTemplate<{ readonly firstName: string; readonly product: VerifiedProduct; readonly previousPrice: Money; readonly endsAt?: string }>({
  ...base, key: "priceDrop", name: "Price drop on saved item", trigger: "catalog.price.dropped (saved items)",
  subject: (p, c) => `Price drop: ${p.product.name} is now ${c.money(p.product.price)}`,
  preheader: (p, c) => `Down from ${c.money(p.previousPrice)}${p.endsAt ? ` until ${c.date(p.endsAt)}` : ""}.`,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Price drop", title: "Something you saved just got cheaper", tone: "success" },
    { type: "products", items: onlyVerified([{ ...p.product, compareAtPrice: p.previousPrice, badge: `Save ${c.money({ ...p.previousPrice, amountMinor: p.previousPrice.amountMinor - p.product.price.amountMinor })}` }]) },
    { type: "button", label: "View item", href: p.product.href },
    ...(p.endsAt ? [{ type: "paragraph" as const, muted: true, text: `The seller set this price until ${c.date(p.endsAt)}.` }] : []),
  ],
  sample: { firstName: "Amaka", product: firstProduct, previousPrice: ngn(99000), endsAt: "2026-10-08T23:59:00.000Z" },
});

export const backInStock = defineEmailTemplate<{ readonly firstName: string; readonly product: VerifiedProduct; readonly remaining?: number }>({
  ...base, key: "backInStock", name: "Back in stock", trigger: "catalog.inventory.restocked (saved or waitlisted)",
  subject: (p) => `Back in stock: ${p.product.name}`,
  preheader: (p) => (p.remaining ? `Only ${p.remaining} available.` : "Grab it before it goes again."),
  blocks: (p) => [
    { type: "hero", eyebrow: "Back in stock", title: "It's back", tone: "success" },
    { type: "products", items: onlyVerified([{ ...p.product, badge: p.remaining ? `Only ${p.remaining} left` : undefined }]) },
    { type: "button", label: "Buy now", href: p.product.href },
  ],
  sample: { firstName: "Amaka", product: { ...(sampleVerified[1] as VerifiedProduct) }, remaining: 4 },
});

export const abandonedCart = defineEmailTemplate<{ readonly firstName: string; readonly items: readonly VerifiedProduct[]; readonly cartUrl: string }>({
  ...base, key: "abandonedCart", name: "Abandoned cart", trigger: "commerce.cart.abandoned (24h, once per cart)",
  subject: () => "You left something in your cart",
  preheader: (p) => `${p.items.length} ${p.items.length === 1 ? "item is" : "items are"} waiting. Prices and stock can change.`,
  blocks: (p) => [
    { type: "hero", eyebrow: "Your cart", title: "Still thinking it over?" },
    { type: "paragraph", text: "We saved your cart. Stock isn't reserved, so popular items may sell out." },
    { type: "products", items: onlyVerified(p.items) },
    { type: "button", label: "Go to checkout", href: p.cartUrl },
    { type: "paragraph", muted: true, text: "Pay safely: your money is held in escrow until you confirm delivery." },
  ],
  sample: { firstName: "Amaka", items: sampleVerified.slice(1, 3), cartUrl: "https://nantty.com/cart" },
});

export const weeklyDigest = defineEmailTemplate<{ readonly firstName: string; readonly weekLabel: string; readonly trending: readonly VerifiedProduct[]; readonly upcomingLives: readonly { readonly name: string; readonly handle: string; readonly note: string }[] }>({
  ...base, key: "weeklyDigest", name: "Weekly digest", trigger: "marketing.digest.weekly",
  subject: (p) => `Your week on Nantty: ${p.weekLabel}`,
  preheader: () => "Trending from verified sellers, plus lives worth tuning into.",
  blocks: (p, c) => [
    { type: "hero", eyebrow: p.weekLabel, title: "This week on Nantty" },
    { type: "products", title: "Trending from verified sellers", items: onlyVerified(p.trending) },
    { type: "divider" },
    { type: "paragraph", text: [{ strong: "Lives coming up" }] },
    { type: "people", items: p.upcomingLives },
    { type: "button", label: "Open Nantty", href: c.url("/") },
  ],
  sample: { firstName: "Amaka", weekLabel: "29 Sep – 5 Oct", trending: sampleVerified, upcomingLives: [{ name: "Adire Lagos Studio", handle: "adirelagos", note: "Thu 7pm · New indigo drop" }, { name: "Kemi Cooks", handle: "kemicooks", note: "Sat 11am · Jollof masterclass" }] },
});

