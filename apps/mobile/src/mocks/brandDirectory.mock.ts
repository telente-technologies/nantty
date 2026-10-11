import type { Verification } from "@/types";
import type { BrandDetail, BrandSummary, BrandTag } from "@/types/brand.type";

import type { CatalogProductKey, DirectoryUserKey } from "./mockImages.mock";
import { avatarImageUrlForUser, coverImageUrlForUser, productImageUrlsForProduct } from "./mockImages.mock";
import { productCategories, storeSummaryById } from "./storeDirectory.mock";

const goldVerification = (tier: "PRO" | "PREMIUM"): Verification => ({ status: "active", type: "business", color: "gold", tier, badgeVisible: true });

export interface MockBrandRecord {
  readonly id: string;
  readonly name: string;
  readonly handle: string;
  readonly ownerUserKey: DirectoryUserKey | null;
  readonly officialStoreId: string | null;
  readonly categoryId: string;
  readonly description: string;
  readonly website: string | null;
  readonly verification: Verification | null;
  readonly followers: number;
  readonly logoUrl: string | null;
  readonly coverUrl: string | null;
}

export const mockBrandRecords: MockBrandRecord[] = [
  {
    id: "br_adire", name: "Adire House", handle: "adirehouse", ownerUserKey: "u_1", officialStoreId: "s_ada", categoryId: "cat_fashion",
    description: "Hand-dyed Adire and Ankara ready-to-wear, designed in Lagos and made with artisans in Abeokuta.",
    website: "https://adirehouse.example", verification: goldVerification("PREMIUM"), followers: 21_400,
    logoUrl: avatarImageUrlForUser("u_1"), coverUrl: coverImageUrlForUser("u_1"),
  },
  {
    id: "br_kofo", name: "Kofo Skincare", handle: "kofoskincare", ownerUserKey: "u_3", officialStoreId: "s_glow", categoryId: "cat_beauty",
    description: "Shea, black soap and vitamin C formulas made for melanin-rich skin.",
    website: "https://kofoskincare.example", verification: goldVerification("PRO"), followers: 16_900,
    logoUrl: productImageUrlsForProduct("b3")[0] ?? null, coverUrl: coverImageUrlForUser("u_3"),
  },
  {
    id: "br_aba", name: "Aba Leatherworks", handle: "abaleatherworks", ownerUserKey: "u_6", officialStoreId: "s_kicks", categoryId: "cat_shoes",
    description: "Full-grain leather shoes and slides hand-stitched in Aba.",
    website: null, verification: goldVerification("PRO"), followers: 9_700,
    logoUrl: productImageUrlsForProduct("s1")[0] ?? null, coverUrl: coverImageUrlForUser("u_6"),
  },
  {
    id: "br_lekki", name: "Lekki Gadgets", handle: "lekkigadgets", ownerUserKey: null, officialStoreId: null, categoryId: "cat_gadgets",
    description: "Everyday tech accessories. This brand hasn't opened an official store on Zudomart yet.",
    website: null, verification: null, followers: 2_300,
    logoUrl: productImageUrlsForProduct("g4")[0] ?? null, coverUrl: productImageUrlsForProduct("g5")[0] ?? null,
  },
];

export const BRAND_ID_BY_PRODUCT_KEY: Partial<Record<CatalogProductKey, string>> = {
  f1: "br_adire", f2: "br_adire", f5: "br_adire", h5: "br_adire",
  b1: "br_kofo", b3: "br_kofo", b4: "br_kofo", b6: "br_kofo",
  s1: "br_aba", s3: "br_aba", s4: "br_aba",
  g4: "br_lekki", g5: "br_lekki",
};

export const brandSellingOverrides = new Map<string, boolean>();

export const isBrandSelling = (brand: MockBrandRecord) => brandSellingOverrides.get(brand.id) ?? brand.officialStoreId !== null;

export const findBrandRecord = (brandId: string) => mockBrandRecords.find((brand) => brand.id === brandId);

export const isVerifiedOfficialStoreOfBrand = (brand: MockBrandRecord, storeId: string) =>
  brand.officialStoreId === storeId && brand.verification?.badgeVisible === true;

export const presentBrandSummary = (brand: MockBrandRecord, followedBrandIds: ReadonlySet<string>): BrandSummary => ({
  id: brand.id,
  name: brand.name,
  handle: brand.handle,
  logoUrl: brand.logoUrl,
  verification: brand.verification,
  followers: brand.followers + (followedBrandIds.has(brand.id) ? 1 : 0),
  officialStoreId: brand.verification?.badgeVisible ? brand.officialStoreId : null,
  sellingEnabled: isBrandSelling(brand),
  showsMart: isBrandSelling(brand),
});

export const presentBrandDetail = (brand: MockBrandRecord, followedBrandIds: ReadonlySet<string>): BrandDetail => ({
  ...presentBrandSummary(brand, followedBrandIds),
  coverUrl: brand.coverUrl,
  categoryName: productCategories.find((category) => category.id === brand.categoryId)?.name ?? "",
  description: brand.description,
  website: brand.website,
  isFollowing: followedBrandIds.has(brand.id),
  ownerUserId: brand.ownerUserKey,
  officialStore: brand.officialStoreId && brand.verification?.badgeVisible ? storeSummaryById(brand.officialStoreId) : null,
});

export const brandTagForProductKey = (productKey: CatalogProductKey): BrandTag | null => {
  const brand = findBrandRecord(BRAND_ID_BY_PRODUCT_KEY[productKey] ?? "");
  return brand ? { id: brand.id, name: brand.name, logoUrl: brand.logoUrl, verification: brand.verification } : null;
};
