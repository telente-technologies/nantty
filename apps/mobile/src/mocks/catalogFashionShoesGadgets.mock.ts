import type { CatalogProductSeed } from "./productCatalog.mock";

const UK_DRESS_SIZES = ["UK 8", "UK 10", "UK 12", "UK 14", "UK 16"];
const MENSWEAR_SIZES = ["S", "M", "L", "XL", "XXL"];
const UK_SHOE_SIZES = ["UK 7", "UK 8", "UK 9", "UK 10", "UK 11", "UK 12"];

export const fashionShoesAndGadgetSeeds: readonly CatalogProductSeed[] = [
  {
    key: "f1", storeId: "s_ada", categoryId: "cat_fashion", name: "Ankara Wrap Midi Dress", usdCents: 3_800, stock: 14, rating: 4.8, reviewCount: 212, addedDaysAgo: 3, salePercent: 15,
    title: "Ankara wrap midi dress with puff sleeves and adjustable waist tie — 100% cotton wax print",
    description: "Our best-selling wrap dress in breathable cotton wax print. Flattering tie waist that adjusts to your shape, midi length that works from church to brunch, and hidden side pockets. Fully lined bodice. Hand wash cold, iron on reverse.",
    sizes: UK_DRESS_SIZES, colors: ["Blue & orange print", "Green & gold print", "Red & black print"],
  },
  {
    key: "f2", storeId: "s_ada", categoryId: "cat_fashion", name: "Adire Two-Piece Set", usdCents: 4_500, stock: 3, rating: 4.9, reviewCount: 96, addedDaysAgo: 5,
    title: "Hand-dyed Adire crop top and wide-leg trouser set from Abeokuta indigo",
    description: "Each set is hand-dyed by our partner artisans in Abeokuta, so no two patterns are exactly alike. Relaxed wide-leg trousers with elastic back waist and a boxy crop top. Colour may fade softly with washing — that's the charm of real indigo.",
    sizes: ["S", "M", "L", "XL"], colors: ["Indigo", "Indigo & white"],
  },
  {
    key: "f3", storeId: "s_ada", categoryId: "cat_fashion", name: "Men's Senator Kaftan", usdCents: 5_500, stock: 9, rating: 4.7, reviewCount: 174, addedDaysAgo: 22,
    title: "Tailored senator kaftan with embroidered neckline and matching trousers",
    description: "Clean-cut senator style in premium cashmere-feel fabric. Subtle tonal embroidery on the neckline and cuffs. Comes as a two-piece (top and trousers). Perfect for weddings, Friday dressing and owambe.",
    sizes: MENSWEAR_SIZES, colors: ["Navy", "Wine", "Cream", "Black"],
  },
  {
    key: "f4", storeId: "s_ada", categoryId: "cat_fashion", name: "Aso-Oke Gele Headtie", usdCents: 2_200, stock: 25, rating: 4.6, reviewCount: 88, addedDaysAgo: 40, salePercent: 10,
    title: "Stiff hand-woven Aso-Oke gele — ties beautifully for weddings and events",
    description: "Traditional hand-woven Aso-Oke with a shimmer finish. Stiff enough to hold dramatic shapes, soft enough to be comfortable all day. Size: 2 yards. Pair it with a matching ipele (sold separately).",
    sizes: [], colors: ["Gold", "Rose gold", "Silver", "Emerald"],
  },
  {
    key: "f5", storeId: "s_ada", categoryId: "cat_fashion", name: "Ankara Bomber Jacket", usdCents: 4_800, stock: 2, rating: 4.5, reviewCount: 61, addedDaysAgo: 12,
    title: "Unisex Ankara bomber jacket with ribbed cuffs and satin lining",
    description: "Street-style bomber in bold wax print with black ribbed collar, cuffs and hem. Satin-lined for a smooth feel, two front pockets and a sturdy YKK zip. Runs slightly large — size down for a fitted look.",
    sizes: MENSWEAR_SIZES, colors: ["Multicolour print"],
  },
  {
    key: "f6", storeId: "s_ada", categoryId: "cat_fashion", name: "Beaded Statement Necklace", usdCents: 1_800, stock: 11, rating: 4.4, reviewCount: 45, addedDaysAgo: 2,
    title: "Handmade coral-style beaded statement necklace with brass clasp",
    description: "Layered coral-style beads strung by hand. Lightweight and hypoallergenic brass clasp. Finishes any traditional outfit — or dresses up a plain white tee.",
    sizes: [], colors: ["Coral red", "Gold & white"],
  },
  {
    key: "s1", storeId: "s_kicks", categoryId: "cat_shoes", name: "Handmade Leather Loafers", usdCents: 4_200, stock: 8, rating: 4.6, reviewCount: 133, addedDaysAgo: 30,
    title: "Full-grain leather penny loafers, hand-stitched in Aba",
    description: "Full-grain cow leather upper, leather lining and a durable rubber sole that grips Lagos roads. Stitched by hand by our team in Aba. Breaks in within a week and lasts for years.",
    sizes: UK_SHOE_SIZES, colors: ["Brown", "Black", "Tan"],
  },
  {
    key: "s2", storeId: "s_kicks", categoryId: "cat_shoes", name: "Classic White Low-Top Sneakers", usdCents: 3_500, stock: 20, rating: 4.3, reviewCount: 208, addedDaysAgo: 6, salePercent: 20,
    title: "Minimal white leather low-top sneakers with cushioned insole",
    description: "The everyday white sneaker that goes with everything. Smooth synthetic leather upper, padded collar and a cushioned insole for long days. Wipe clean with a damp cloth.",
    sizes: UK_SHOE_SIZES, colors: ["White", "White & gum sole"],
  },
  {
    key: "s3", storeId: "s_kicks", categoryId: "cat_shoes", name: "Leather Palm Slides", usdCents: 2_000, stock: 4, rating: 4.5, reviewCount: 172, addedDaysAgo: 14,
    title: "Men's handmade leather palm slippers with crossover strap",
    description: "Classic Aba palm slippers in genuine leather with a padded footbed. Easy to wear to the mosque, the office on Fridays or a weekend hangout.",
    sizes: UK_SHOE_SIZES, colors: ["Brown", "Black"],
  },
  {
    key: "s4", storeId: "s_kicks", categoryId: "cat_shoes", name: "Suede Chelsea Boots", usdCents: 6_000, stock: 6, rating: 4.7, reviewCount: 58, addedDaysAgo: 18,
    title: "Suede Chelsea boots with elastic side panels and stacked heel",
    description: "Soft suede Chelsea boots with pull tabs and elastic gussets for easy on-off. Stacked leather heel. Treat with suede protector before the rains.",
    sizes: UK_SHOE_SIZES, colors: ["Sand", "Chocolate"],
  },
  {
    key: "s5", storeId: "s_kicks", categoryId: "cat_shoes", name: "Lightweight Running Trainers", usdCents: 4_000, stock: 12, rating: 4.2, reviewCount: 77, addedDaysAgo: 4,
    title: "Breathable knit running trainers with foam midsole",
    description: "Breathable knit upper, responsive foam midsole and a grippy outsole for early-morning runs around the estate. Machine washable on a gentle cycle.",
    sizes: UK_SHOE_SIZES, colors: ["Black", "Grey", "Blue"],
  },
  {
    key: "g1", storeId: "s_tunde", categoryId: "cat_gadgets", name: "Wireless Earbuds Pro", usdCents: 3_200, stock: 30, rating: 4.5, reviewCount: 389, addedDaysAgo: 9, salePercent: 25,
    title: "True wireless earbuds with active noise cancellation and 30-hour battery",
    description: "Active noise cancellation for noisy BRT rides, transparency mode, 8 hours per charge and 30 hours with the case. USB-C fast charging, IPX4 sweat resistance. 1-year warranty.",
    sizes: [], colors: ["Black", "White"],
  },
  {
    key: "g2", storeId: "s_tunde", categoryId: "cat_gadgets", name: "20,000mAh Power Bank", usdCents: 2_400, stock: 40, rating: 4.7, reviewCount: 512, addedDaysAgo: 35,
    title: "20,000mAh fast-charging power bank with 2 USB-A and 1 USB-C port",
    description: "Survives the longest NEPA outage. Charges a phone 4–5 times, 22.5W fast charging, digital battery display and three ports so the whole family can charge. Airline safe.",
    sizes: [], colors: ["Black", "White"],
  },
  {
    key: "g3", storeId: "s_tunde", categoryId: "cat_gadgets", name: "Smartwatch Series 5", usdCents: 5_800, stock: 5, rating: 4.3, reviewCount: 141, addedDaysAgo: 1,
    title: "Smartwatch with AMOLED display, heart-rate, SpO2 and call notifications",
    description: "1.8\" AMOLED display, heart-rate and SpO2 tracking, 100+ workout modes and WhatsApp notifications. Up to 7 days of battery. Works with Android and iPhone.",
    sizes: [], colors: ["Midnight black", "Silver", "Rose gold"],
  },
  {
    key: "g4", storeId: "s_tunde", categoryId: "cat_gadgets", name: "Mini Bluetooth Speaker", usdCents: 2_900, stock: 1, rating: 4.4, reviewCount: 96, addedDaysAgo: 27,
    title: "Portable waterproof Bluetooth speaker with deep bass and 12-hour play",
    description: "Small speaker, big sound. IPX7 waterproof so it's fine at the pool party, 12-hour battery and a strap to hang it anywhere. Pair two for stereo.",
    sizes: [], colors: ["Black", "Blue", "Red"],
  },
  {
    key: "g5", storeId: "s_tunde", categoryId: "cat_gadgets", name: "Aluminium Laptop Stand", usdCents: 2_100, stock: 17, rating: 4.8, reviewCount: 203, addedDaysAgo: 50,
    title: "Adjustable aluminium laptop stand for 10–17\" laptops",
    description: "Raise your screen to eye level and save your neck. Six height settings, non-slip silicone pads and it folds flat into your laptop bag.",
    sizes: [], colors: ["Silver", "Space grey"],
  },
  {
    key: "g6", storeId: "s_tunde", categoryId: "cat_gadgets", name: "Over-Ear Noise Cancelling Headphones", usdCents: 7_500, stock: 7, rating: 4.7, reviewCount: 264, addedDaysAgo: 16,
    title: "Wireless over-ear headphones with hybrid ANC and 40-hour battery",
    description: "Hybrid active noise cancelling, plush memory-foam cushions and 40 hours of playback. Multipoint Bluetooth connects your laptop and phone at once. Includes hard case and 3.5mm cable.",
    sizes: [], colors: ["Black", "Beige", "Navy"],
  },
  {
    key: "g7", storeId: "s_tunde", categoryId: "cat_gadgets", name: "Custom Mechanical Keyboard", usdCents: 6_500, stock: 3, rating: 4.9, reviewCount: 118, addedDaysAgo: 8,
    title: "75% hot-swappable mechanical keyboard with tactile switches and PBT keycaps",
    description: "Hot-swappable sockets, pre-lubed tactile switches, PBT double-shot keycaps and a gasket mount for that soft thock. Connects by USB-C, Bluetooth or 2.4GHz dongle. Mac and Windows layouts.",
    sizes: [], colors: ["Cream & sage", "Black & grey"],
    variants: [{ name: "Switch type", options: ["Tactile", "Linear", "Clicky"] }, { name: "Connectivity", options: ["USB-C", "Bluetooth", "2.4GHz"] }],
  },
];
