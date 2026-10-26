import type { Money, ProductCard, SellerItemGroup } from "../emailTypes";

export function ngn(naira: number): Money {
  return { amountMinor: Math.round(naira * 100), currency: "NGN" };
}

export function usd(dollars: number): Money {
  return { amountMinor: Math.round(dollars * 100), currency: "USD" };
}

const image = (id: string) => `https://images.unsplash.com/${id}?w=256&h=256&fit=crop&auto=format&q=80`;
const placeholder = (label: string) => `https://placehold.co/256x256/e8e4dc/55504a/png?text=${encodeURIComponent(label)}`;

export const sampleImages = {
  sneakers: placeholder("Sandals"),
  headphones: image("photo-1505740420928-5e560c06d30e"),
  watch: image("photo-1523275335684-37898b6baf30"),
  bag: placeholder("Tote"),
  perfume: image("photo-1541643600914-78b084683601"),
  camera: image("photo-1516035069371-29a1b244cc32"),
};

export const sampleOrderGroups: readonly SellerItemGroup[] = [
  {
    sellerName: "Adire Lagos Studio",
    sellerVerified: true,
    shipping: ngn(2500),
    shippingMethod: "GIG Logistics, 2–4 days",
    items: [
      { name: "Hand-dyed adire two-piece", variant: "Indigo · Size M", quantity: 1, unitPrice: ngn(38500), imageUrl: sampleImages.bag },
      { name: "Leather slide sandals", variant: "Tan · 42", quantity: 2, unitPrice: ngn(14000), imageUrl: sampleImages.sneakers },
    ],
  },
  {
    sellerName: "Gadget Hub NG",
    sellerVerified: true,
    shipping: ngn(0),
    shippingMethod: "Free delivery, Lagos",
    items: [{ name: "Wireless over-ear headphones", variant: "Matte black", quantity: 1, unitPrice: ngn(62000), imageUrl: sampleImages.headphones }],
  },
];

export const sampleProducts: readonly ProductCard[] = [
  { name: "Classic chronograph watch", imageUrl: sampleImages.watch, price: ngn(84500), compareAtPrice: ngn(99000), sellerName: "Timepiece Co.", href: "https://nantty.com/p/classic-chronograph" },
  { name: "Oud & amber eau de parfum", imageUrl: sampleImages.perfume, price: ngn(46000), sellerName: "Scent Bar Abuja", href: "https://nantty.com/p/oud-amber" },
  { name: "Mirrorless camera kit", imageUrl: sampleImages.camera, price: ngn(615000), compareAtPrice: ngn(680000), sellerName: "Gadget Hub NG", href: "https://nantty.com/p/mirrorless-kit" },
  { name: "Everyday leather tote", imageUrl: sampleImages.bag, price: ngn(52000), sellerName: "Adire Lagos Studio", href: "https://nantty.com/p/leather-tote" },
];

export const sampleDevice = { device: "iPhone 16 Pro · Nantty app", location: "Ikeja, Lagos, Nigeria (approximate)", ipAddress: "102.89.34.17", occurredAt: "2026-10-03T08:42:00.000Z" };
