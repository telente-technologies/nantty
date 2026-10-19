import { buildUnsplashImageUrl, shiftTimestampByDays } from "@/mocks/seed/seededRandom.mock";
import type { ContentSource, CreativeIdentity, CreativeMedia } from "@/types/creative.type";

export const demoPhotoIds = {
  adireShirt: "1602810318383-e386cc2a3ccf",
  crewTee: "1618354691373-d851c5c3a990",
  bomber: "1591047139829-d91aecb6caea",
  trailRunner: "1491553895911-0055eca6402d",
  streetSneakers: "1560769629-975ec94e6a86",
  sunglasses: "1572635196237-14b3f281503f",
  topHandleBag: "1584917865442-de89df76afd3",
  crossbodyBag: "1600857062241-98e5dba7f214",
  pearlNecklace: "1515562141207-7a88fb7ce338",
  faceSerum: "1608571423902-eed4a5ad8108",
  bodyOil: "1611930022073-b7a4ba5fcccd",
  headphones: "1505740420928-5e560c06d30e",
  earbuds: "1606220588913-b3aacb4d2f46",
  smartwatch: "1523275335684-37898b6baf30",
  candle: "1603006905003-be475563bc59",
  orangeJuice: "1600271886742-f049cd451bba",
  pendant: "1599643478518-a784e5dc4c8f",
  backpack: "1553062407-98eeb64c6a62",
} as const;

export type DemoPhotoKey = keyof typeof demoPhotoIds;

export function buildDemoImageMedia(photoKey: DemoPhotoKey, shape: "square" | "portrait" = "square"): CreativeMedia {
  return { id: `med_${photoKey}`, kind: "image", url: buildUnsplashImageUrl(demoPhotoIds[photoKey]), posterUrl: null, width: 800, height: shape === "portrait" ? 1422 : 800, durationSeconds: null };
}

export function buildDemoClipMedia(photoKey: DemoPhotoKey, durationSeconds: number): CreativeMedia {
  return { id: `med_clip_${photoKey}`, kind: "video", url: "", posterUrl: buildUnsplashImageUrl(demoPhotoIds[photoKey]), width: 720, height: 1280, durationSeconds };
}

export function buildDemoLandscapeVideoMedia(photoKey: DemoPhotoKey, durationSeconds: number): CreativeMedia {
  return { id: `med_wide_${photoKey}`, kind: "video", url: "", posterUrl: buildUnsplashImageUrl(demoPhotoIds[photoKey]), width: 1920, height: 1080, durationSeconds };
}

function buildDemoLiveSource(accountId: string, id: string, title: string, text: string, photoKey: DemoPhotoKey, status: "scheduled" | "live", viewerCount: number): ContentSource & { accountId: string } {
  const startsAt = status === "live" ? shiftTimestampByDays(0, new Date().getUTCHours()) : shiftTimestampByDays(2, 18);
  return {
    id,
    accountId,
    type: "live",
    title,
    text,
    media: [{ id: `med_live_${id}`, kind: "image", url: buildUnsplashImageUrl(demoPhotoIds[photoKey]), posterUrl: null, width: 720, height: 1280, durationSeconds: null }],
    createdAt: shiftTimestampByDays(-1, 12),
    engagement: { likes: 0, comments: 0, views: viewerCount },
    product: null,
    live: { liveSessionId: id, status, startsAt, viewerCount },
    eligible: true,
    ineligibleReason: null,
  };
}

export const demoIdentitiesByAccountId: Record<string, CreativeIdentity> = {
  act_ifelifestyle: { name: "Ife Lifestyle", handle: "ifelifestyle", avatarUrl: null, verifiedBusiness: true },
  act_adaeze: { name: "Adaeze Okafor", handle: "adaeze.okafor", avatarUrl: null, verifiedBusiness: false },
  act_kelechikicks: { name: "Kelechi Kicks", handle: "kelechi.kicks", avatarUrl: null, verifiedBusiness: false },
  act_kenteheritage: { name: "Kente Heritage", handle: "kente.heritage", avatarUrl: null, verifiedBusiness: true },
};

function money(amountMajor: number, currency: string) {
  return { amountMinor: Math.round(amountMajor * 100), currency };
}

type SourceSeed = [id: string, type: ContentSource["type"], title: string, text: string, media: CreativeMedia[], daysAgo: number, likes: number, views: number, product: ContentSource["product"]];

function convertSeedsToSources(accountId: string, seeds: readonly SourceSeed[]): (ContentSource & { accountId: string })[] {
  return seeds.map(([id, type, title, text, media, daysAgo, likes, views, product]) => ({
    id,
    accountId,
    type,
    title,
    text,
    media,
    createdAt: shiftTimestampByDays(-daysAgo, 12),
    engagement: { likes, comments: Math.round(likes / 9), views },
    product,
    eligible: !/giveaway/i.test(text),
    ineligibleReason: /giveaway/i.test(text) ? "Posts that run a giveaway cannot be promoted." : null,
  }));
}

export function buildDemoContentSources(): (ContentSource & { accountId: string })[] {
  const naira = (amount: number) => money(amount, "NGN");
  return [
    ...convertSeedsToSources("act_ifelifestyle", [
      ["pst_ife_adire", "post", "Adire Oxford is back", "Hand-dyed in Abeokuta, cut in Lagos. The Adire Oxford is back in indigo and wine. Sizes S–XL.", [buildDemoImageMedia("adireShirt"), buildDemoImageMedia("crewTee")], 6, 1840, 22_400, null],
      ["pst_ife_bomber", "post", "Harmattan layers", "Rust bomber for cool harmattan evenings. Light satin, warm lining.", [buildDemoImageMedia("bomber")], 12, 960, 14_100, null],
      ["pst_ife_giveaway", "post", "Giveaway Friday", "Giveaway! Tag 3 friends to win an adire tote.", [buildDemoImageMedia("crossbodyBag")], 3, 4120, 51_000, null],
      ["clp_ife_serum", "clip", "30-second glow routine", "Our Glow Serum, 3 drops, morning and night. Watch the full routine.", [buildDemoClipMedia("faceSerum", 31)], 9, 5300, 88_000, null],
      ["pst_ife_workshop", "post", "Inside our Abeokuta dye workshop", "A day with the women who dye every Ife Lifestyle adire panel by hand. Full documentary, 1 minute 34.", [buildDemoLandscapeVideoMedia("adireShirt", 94)], 18, 2650, 61_200, null],
      ["clp_ife_styling", "clip", "3 ways to style adire", "Office, owambe, weekend: one shirt, three looks.", [buildDemoClipMedia("adireShirt", 42)], 15, 7210, 130_400, null],
      ["prd_ife_adire", "product", "Adire Oxford Shirt", "Hand-dyed adire panels on breathable cotton oxford.", [buildDemoImageMedia("adireShirt")], 40, 0, 0, { productId: "prd_ife_adire", title: "Adire Oxford Shirt", price: naira(18_500), compareAtPrice: naira(22_000), rating: 4.8 }],
      ["prd_ife_bag", "product", "Leather Top-Handle Bag", "Structured leather bag with a detachable strap.", [buildDemoImageMedia("topHandleBag")], 55, 0, 0, { productId: "prd_ife_bag", title: "Leather Top-Handle Bag", price: naira(68_000), compareAtPrice: null, rating: 4.6 }],
      ["prd_ife_serum", "product", "Glow Face Serum 30ml", "Vitamin C and niacinamide for an even glow.", [buildDemoImageMedia("faceSerum")], 30, 0, 0, { productId: "prd_ife_serum", title: "Glow Face Serum 30ml", price: naira(12_500), compareAtPrice: null, rating: 4.9 }],
      ["prd_ife_pearls", "product", "Pearl Strand Necklace", "Freshwater pearls on a silk thread.", [buildDemoImageMedia("pearlNecklace")], 25, 0, 0, { productId: "prd_ife_pearls", title: "Pearl Strand Necklace", price: naira(27_500), compareAtPrice: naira(31_000), rating: 4.7 }],
      ["st_ifelifestyle", "store", "Ife Lifestyle store", "Fashion, bags and beauty made in Nigeria. Delivery in 2–4 days nationwide.", [buildDemoImageMedia("topHandleBag"), buildDemoImageMedia("adireShirt"), buildDemoImageMedia("faceSerum")], 210, 0, 0, null],
    ]),
    buildDemoLiveSource("act_ifelifestyle", "liv_ife_now", "Live now: pearls & pendants restock", "Join us live — every piece shown up close, questions answered, pay on delivery in Lagos.", "pearlNecklace", "live", 1240),
    buildDemoLiveSource("act_ifelifestyle", "liv_ife_friday", "Friday live: new bag drop", "Seven new leather bags, live prices, first 20 orders get free delivery.", "topHandleBag", "scheduled", 0),
    buildDemoLiveSource("act_kelechikicks", "liv_kk_now", "Sneaker restock live from Aba", "Every colourway on camera. Ask for your size in the comments.", "trailRunner", "live", 430),
    ...convertSeedsToSources("act_adaeze", [
      ["clp_adaeze_lekki", "clip", "Saturday at Lekki market", "Come thrift with me at Lekki market — best finds under ₦10k.", [buildDemoClipMedia("sunglasses", 58)], 4, 2100, 40_300, null],
      ["pst_adaeze_candle", "post", "Lagos Rain candle review", "Honest review of the Lagos Rain candle. It smells like the first rain in April.", [buildDemoImageMedia("candle")], 11, 380, 5200, null],
    ]),
    ...convertSeedsToSources("act_kelechikicks", [
      ["prd_kk_runner", "product", "Trail Runner Sneakers", "Cushioned runners with a grippy outsole.", [buildDemoImageMedia("trailRunner")], 60, 0, 0, { productId: "prd_kk_runner", title: "Trail Runner Sneakers", price: naira(56_000), compareAtPrice: null, rating: 4.5 }],
      ["prd_kk_street", "product", "Street Sneakers", "Chunky everyday sneakers in a pastel colourway.", [buildDemoImageMedia("streetSneakers")], 45, 0, 0, { productId: "prd_kk_street", title: "Street Sneakers", price: naira(48_500), compareAtPrice: naira(55_000), rating: 4.4 }],
      ["clp_kk_unbox", "clip", "Unboxing the new drop", "New drop just landed in Aba. Unboxing every colourway.", [buildDemoClipMedia("streetSneakers", 27)], 5, 1200, 30_100, null],
      ["st_kelechikicks", "store", "Kelechi Kicks store", "Sneakers from Aba and beyond. Pay on delivery in Lagos, Abuja and PH.", [buildDemoImageMedia("streetSneakers"), buildDemoImageMedia("trailRunner")], 95, 0, 0, null],
    ]),
    ...convertSeedsToSources("act_kenteheritage", [
      ["prd_kente_pendant", "product", "Gold Pendant Necklace", "Gold-plated chain with a crescent pendant.", [buildDemoImageMedia("pendant")], 20, 0, 0, { productId: "prd_kente_pendant", title: "Gold Pendant Necklace", price: money(420, "GHS"), compareAtPrice: null, rating: 4.8 }],
      ["pst_kente_bag", "post", "Market day in Kumasi", "Hand-finished crossbody bags from Kumasi, now shipping across Ghana.", [buildDemoImageMedia("crossbodyBag")], 8, 640, 9800, null],
    ]),
  ];
}
