import type { Category, StoreSummary } from "@/types";

import { avatarImageUrlForUser, coverImageUrlForUser, type DirectoryUserKey } from "./mockImages.mock";

export const productCategories: readonly Category[] = [
  { id: "cat_fashion", name: "Fashion" },
  { id: "cat_shoes", name: "Shoes" },
  { id: "cat_gadgets", name: "Phones & Gadgets" },
  { id: "cat_beauty", name: "Beauty & Personal Care" },
  { id: "cat_home", name: "Home & Kitchen" },
  { id: "cat_food", name: "Food & Groceries" },
  { id: "cat_kids", name: "Kids & Baby" },
];

export interface DirectoryStore {
  readonly id: string;
  readonly name: string;
  readonly handle: string;
  readonly ownerUserKey: DirectoryUserKey;
  readonly categoryId: string;
  readonly bio: string;
  readonly city: string;
  readonly joinedAt: string;
  readonly rating: number;
  readonly ratingCount: number;
  readonly reviewCount: number;
  readonly followers: number;
  readonly verified: boolean;
  readonly shippingInfo: string;
}

export const directoryStores: readonly DirectoryStore[] = [
  {
    id: "s_ada", name: "Adaeze Styles", handle: "adaeze.styles", ownerUserKey: "u_1", categoryId: "cat_fashion",
    bio: "Contemporary Ankara, Adire and Aso-Oke pieces cut and sewn in our Lekki studio. Custom sizes available.",
    city: "Lekki, Lagos", joinedAt: "2024-06-01T00:00:00.000Z", rating: 4.8, ratingCount: 1240, reviewCount: 612, followers: 48200, verified: true,
    shippingInfo: "Ships from Lekki within 2 working days. Lagos delivery 1–2 days, other states 3–5 days via GIG Logistics. Free returns within 7 days if the fit is wrong.",
  },
  {
    id: "s_tunde", name: "TundeTech Gadgets", handle: "tundetech", ownerUserKey: "u_2", categoryId: "cat_gadgets",
    bio: "100% original phones, audio and accessories. Every item is tested before dispatch and comes with a 1-year warranty.",
    city: "Ikeja, Lagos", joinedAt: "2024-08-19T00:00:00.000Z", rating: 4.6, ratingCount: 980, reviewCount: 455, followers: 31500, verified: true,
    shippingInfo: "Same-day dispatch for orders before 2pm. Lagos delivery next day; other states 2–4 days. Sealed box — open on delivery and confirm before release.",
  },
  {
    id: "s_glow", name: "Glow by Zainab", handle: "glowbyzainab", ownerUserKey: "u_3", categoryId: "cat_beauty",
    bio: "Small-batch skincare made with Nigerian shea, black soap and botanicals. Dermatologist-tested for melanin-rich skin.",
    city: "Wuse 2, Abuja", joinedAt: "2024-10-07T00:00:00.000Z", rating: 4.7, ratingCount: 760, reviewCount: 388, followers: 27800, verified: true,
    shippingInfo: "Packed within 24 hours in bubble wrap. Abuja delivery 1 day, Lagos 2 days, other states 3–5 days. Unopened items can be returned within 7 days.",
  },
  {
    id: "s_home", name: "Temi's Home & Kitchen", handle: "temi.homes", ownerUserKey: "u_me", categoryId: "cat_home",
    bio: "Handmade homeware from Ibadan artisans — clay pots, raffia, candles and everyday kitchen essentials.",
    city: "Bodija, Ibadan", joinedAt: "2025-03-14T00:00:00.000Z", rating: 4.5, ratingCount: 214, reviewCount: 131, followers: 6840, verified: true,
    shippingInfo: "Fragile items are double-boxed. Ibadan delivery 1 day, Lagos 2 days, other states 3–6 days. Breakages in transit are replaced free.",
  },
  {
    id: "s_food", name: "Mama Nkechi Foods", handle: "mamankechi.foods", ownerUserKey: "u_4", categoryId: "cat_food",
    bio: "Stone-free Ofada rice, fresh palm oil, home-made spices and snacks. Cooked-with-love quality since 2009.",
    city: "Independence Layout, Enugu", joinedAt: "2025-01-22T00:00:00.000Z", rating: 4.9, ratingCount: 530, reviewCount: 297, followers: 9400, verified: false,
    shippingInfo: "Dry foods ship in sealed packs within 48 hours. Enugu 1 day, other states 2–5 days. Palm oil ships in leak-proof kegs.",
  },
  {
    id: "s_kids", name: "Little Kings & Queens", handle: "littlekingsng", ownerUserKey: "u_5", categoryId: "cat_kids",
    bio: "Baby and kids clothing, toys and school supplies. Everything is child-safe and tested by our own three little ones.",
    city: "Surulere, Lagos", joinedAt: "2025-02-10T00:00:00.000Z", rating: 4.6, ratingCount: 402, reviewCount: 219, followers: 12600, verified: false,
    shippingInfo: "Ships within 2 working days. Lagos 1–2 days, other states 3–5 days. Exchange sizes within 7 days, tags on.",
  },
  {
    id: "s_kicks", name: "Kicks by Emeka", handle: "kicksbyemeka", ownerUserKey: "u_6", categoryId: "cat_shoes",
    bio: "Handmade Aba leather shoes and clean everyday sneakers. Sizes UK 6–13.",
    city: "Aba, Abia", joinedAt: "2024-12-03T00:00:00.000Z", rating: 4.4, ratingCount: 690, reviewCount: 344, followers: 18900, verified: true,
    shippingInfo: "Made-to-order leather ships in 3–5 days; sneakers ship in 1–2 days. Nationwide delivery 2–5 days. Free size exchange once.",
  },
];

export const findDirectoryStoreById = (storeId: string): DirectoryStore => directoryStores.find((store) => store.id === storeId) ?? directoryStores[0]!;

export const summariseStore = (store: DirectoryStore): StoreSummary => ({
  id: store.id,
  name: store.name,
  logoUrl: avatarImageUrlForUser(store.ownerUserKey),
  rating: store.rating,
  ratingCount: store.ratingCount,
  reviewCount: store.reviewCount,
});

export const storeBannerUrl = (store: DirectoryStore) => coverImageUrlForUser(store.ownerUserKey);

export const storeSummaryById = (storeId: string): StoreSummary => summariseStore(findDirectoryStoreById(storeId));
