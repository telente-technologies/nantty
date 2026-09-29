import type { Money } from "@/types/money.type";

export const landingPhotoIds = {
  adireShirt: "1602810318383-e386cc2a3ccf",
  streetSneakers: "1560769629-975ec94e6a86",
  topHandleBag: "1584917865442-de89df76afd3",
  crossbodyBag: "1600857062241-98e5dba7f214",
  faceSerum: "1608571423902-eed4a5ad8108",
  pearlNecklace: "1515562141207-7a88fb7ce338",
  earbuds: "1606220588913-b3aacb4d2f46",
} as const;

export type LandingPhotoKey = keyof typeof landingPhotoIds;

export function buildLandingPhotoUrl(photoKey: LandingPhotoKey, width = 600): string {
  return `https://images.unsplash.com/photo-${landingPhotoIds[photoKey]}?w=${width}&q=80&fm=webp`;
}

function naira(amountMajor: number): Money {
  return { amountMinor: amountMajor * 100, currency: "NGN" };
}

export interface ShowcaseProductTile {
  readonly photoKey: LandingPhotoKey;
  readonly title: string;
  readonly storeName: string;
  readonly price: Money;
  readonly rating: number;
  readonly isSponsored: boolean;
}

export const marketplaceGridTiles: readonly ShowcaseProductTile[] = [
  { photoKey: "streetSneakers", title: "Street Sneakers", storeName: "Kelechi Kicks", price: naira(48_500), rating: 4.4, isSponsored: false },
  { photoKey: "adireShirt", title: "Adire Oxford Shirt", storeName: "Ife Lifestyle", price: naira(18_500), rating: 4.8, isSponsored: true },
  { photoKey: "earbuds", title: "Wireless Earbuds", storeName: "Gadget Hub Ikeja", price: naira(26_500), rating: 4.6, isSponsored: false },
  { photoKey: "pearlNecklace", title: "Pearl Strand Necklace", storeName: "Ife Lifestyle", price: naira(27_500), rating: 4.7, isSponsored: false },
];

export interface ShowcaseFeedPost {
  readonly storeName: string;
  readonly photoKey: LandingPhotoKey;
  readonly imageAlt: string;
  readonly text: string;
  readonly callToAction: string;
  readonly likes: string;
  readonly comments: string;
  readonly reposts: string;
}

export const feedShowcasePost: ShowcaseFeedPost = {
  storeName: "Ife Lifestyle",
  imageAlt: "Red leather top-handle bag from the sponsored post",
  photoKey: "topHandleBag",
  text: "Structured leather, roomy enough for the laptop. Free delivery in Lagos this week.",
  callToAction: "Shop now",
  likes: "1.8K",
  comments: "204",
  reposts: "96",
};

export const reelsShowcaseClip = {
  storeName: "Ife Lifestyle",
  photoKey: "faceSerum" as LandingPhotoKey,
  caption: "Our 30-second glow routine. Three drops, morning and night.",
  callToAction: "Shop now",
  duration: "0:31",
};

export const liveShowcaseStream = {
  storeName: "Kelechi Kicks",
  photoKey: "crossbodyBag" as LandingPhotoKey,
  title: "Friday restock: bags and sneakers, live from Aba",
  watching: "1.2K watching",
};

export const heroFeedPost: ShowcaseFeedPost = {
  storeName: "Ife Lifestyle",
  photoKey: "adireShirt",
  imageAlt: "Folded adire shirts in indigo and wine",
  text: "Hand-dyed in Abeokuta, cut in Lagos. The Adire Oxford is back.",
  callToAction: "Shop now",
  likes: "2.4K",
  comments: "318",
  reposts: "142",
};
