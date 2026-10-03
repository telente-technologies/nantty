import { buildUnsplashImageUrl, unsplashPhotoIds } from "@/mocks/seed/unsplashPhotoIds.mock";
import type { CatalogCategory, ContentTopic, MartHomeImageOption } from "@/types/catalog.type";

export interface MockMartHomeFeatureRecord {
  id: string;
  title: string;
  subtitle: string | null;
  kind: "HERO_BANNER" | "PROMO_BANNER" | "FEATURED_COLLECTION" | "FEATURED_STORE";
  imageId: string;
  targetType: "CATEGORY" | "COLLECTION" | "STORE" | "PRODUCT" | "URL";
  targetValue: string;
  countries: string[];
  startsAt: string;
  endsAt: string | null;
  priority: number;
  isPublished: boolean;
  updatedAt: string;
}

function daysFromNowIso(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

type CategorySeed = readonly [name: string, iconName: string | null, productCount: number, children: readonly (readonly [string, number])[]];

const categorySeeds: readonly CategorySeed[] = [
  ["Fashion", "tag24", 0, [["Women's clothing", 48_210], ["Men's clothing", 31_870], ["Aso-ebi & traditional", 12_430], ["Shoes", 22_950], ["Bags", 9_310]]],
  ["Beauty", "star16", 0, [["Skincare", 18_400], ["Hair & wigs", 26_120], ["Makeup", 11_760], ["Fragrance", 5_230]]],
  ["Electronics", "speakerHigh24", 0, [["Phones & tablets", 14_890], ["Laptops", 3_420], ["Audio", 6_780], ["Phone accessories", 21_300]]],
  ["Home & kitchen", "buildingStore20", 0, [["Kitchen & dining", 9_870], ["Home decor", 7_120], ["Furniture", 2_310]]],
  ["Food & groceries", "shoppingCart24", 0, [["Spices & soup ingredients", 4_560], ["Drinks", 3_210], ["Snacks", 2_980]]],
  ["Kids & baby", "userCircle24", 0, [["Baby essentials", 3_870], ["Toys", 2_140]]],
  ["Automotive", "truck24", 0, [["Spare parts", 1_980], ["Car accessories", 1_450]]],
];

function slugify(text: string): string {
  return text.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function buildDemoCatalogCategories(): CatalogCategory[] {
  const categories: CatalogCategory[] = [];
  categorySeeds.forEach(([name, iconName, , children], parentIndex) => {
    const parentId = `cat_${String(parentIndex + 1).padStart(2, "0")}`;
    const productCount = children.reduce((sum, [, count]) => sum + count, 0);
    categories.push({ id: parentId, parentId: null, name, slug: slugify(name), iconName, isActive: true, sortOrder: parentIndex, productCount, updatedAt: daysFromNowIso(-40 + parentIndex) });
    children.forEach(([childName, childCount], childIndex) => {
      categories.push({ id: `${parentId}_${String(childIndex + 1).padStart(2, "0")}`, parentId, name: childName, slug: slugify(childName), iconName: null, isActive: !(parentIndex === 6 && childIndex === 1), sortOrder: childIndex, productCount: childCount, updatedAt: daysFromNowIso(-30 + childIndex) });
    });
  });
  return categories;
}

const topicSeeds: readonly (readonly [string, number, number, boolean, boolean])[] = [
  ["Fashion & style", 812_300, 1_420_000, true, true],
  ["Nollywood", 402_110, 980_400, true, true],
  ["Afrobeats", 655_900, 1_870_200, true, true],
  ["Football", 520_430, 1_310_000, false, true],
  ["Food & recipes", 318_700, 760_900, false, true],
  ["Tech & gadgets", 204_560, 512_300, false, true],
  ["Beauty & hair", 390_020, 902_100, true, true],
  ["Comedy skits", 610_880, 2_010_300, false, true],
  ["Small business", 98_400, 240_700, false, true],
  ["Travel", 76_300, 190_800, false, true],
  ["Fitness", 64_210, 150_200, false, true],
  ["Parenting", 41_900, 88_600, false, true],
  ["Crypto signals", 12_300, 30_400, false, false],
];

export function buildDemoContentTopics(): ContentTopic[] {
  return topicSeeds.map(([name, postCount, followerCount, isTrending, isActive], index) => ({
    id: `top_${String(index + 1).padStart(2, "0")}`,
    name,
    slug: slugify(name),
    status: isActive ? "ACTIVE" : "HIDDEN",
    isTrending,
    postCount,
    followerCount,
    updatedAt: daysFromNowIso(-index * 3),
  }));
}

export function buildMartHomeImageLibrary(): MartHomeImageOption[] {
  const martLabels: Record<keyof typeof unsplashPhotoIds.mart, string> = { heroBanner: "Shopping bags hero", heroBannerAlt: "Fashion rack hero", salesOfTheDay: "Sales of the day", featuredBrands: "Featured brands", newArrivals: "New arrivals store" };
  const martImages = (Object.keys(martLabels) as (keyof typeof unsplashPhotoIds.mart)[]).map((key) => ({ id: `mart:${key}`, label: martLabels[key], url: buildUnsplashImageUrl(unsplashPhotoIds.mart[key], 1200) }));
  const productPicks: readonly (readonly [keyof typeof unsplashPhotoIds.products, string])[] = [["g6", "Headphones"], ["b6", "Beauty products"], ["h3", "Home decor"], ["s2", "Sneakers"], ["k2", "Kids toys"], ["fd2", "Groceries"]];
  const productImages = productPicks.map(([key, label]) => ({ id: `product:${key}`, label, url: buildUnsplashImageUrl(unsplashPhotoIds.products[key][0], 1200) }));
  return [...martImages, ...productImages];
}

export function buildDemoMartHomeFeatures(): MockMartHomeFeatureRecord[] {
  return [
    { id: "feat_01", title: "Owambe season is here", subtitle: "Aso-ebi, gele and shoes from verified sellers", kind: "HERO_BANNER", imageId: "mart:heroBannerAlt", targetType: "CATEGORY", targetValue: "cat_01_03", countries: ["NG"], startsAt: daysFromNowIso(-5), endsAt: daysFromNowIso(9), priority: 1, isPublished: true, updatedAt: daysFromNowIso(-5) },
    { id: "feat_02", title: "Sales of the day", subtitle: "Fresh deals every morning at 9", kind: "PROMO_BANNER", imageId: "mart:salesOfTheDay", targetType: "COLLECTION", targetValue: "daily-deals", countries: ["NG", "GH", "KE"], startsAt: daysFromNowIso(-30), endsAt: null, priority: 2, isPublished: true, updatedAt: daysFromNowIso(-12) },
    { id: "feat_03", title: "Gold verified brands", subtitle: "Shop stores with the Gold badge", kind: "FEATURED_COLLECTION", imageId: "mart:featuredBrands", targetType: "COLLECTION", targetValue: "gold-verified", countries: ["NG", "GH"], startsAt: daysFromNowIso(-2), endsAt: daysFromNowIso(28), priority: 3, isPublished: true, updatedAt: daysFromNowIso(-2) },
    { id: "feat_04", title: "Back to school", subtitle: "Bags, shoes and gadgets for the new term", kind: "PROMO_BANNER", imageId: "product:k2", targetType: "CATEGORY", targetValue: "cat_06", countries: ["NG"], startsAt: daysFromNowIso(4), endsAt: daysFromNowIso(21), priority: 4, isPublished: true, updatedAt: daysFromNowIso(-1) },
    { id: "feat_05", title: "Kemi's Kitchen", subtitle: "Store of the week", kind: "FEATURED_STORE", imageId: "product:fd2", targetType: "STORE", targetValue: "kemi.kitchen", countries: ["NG"], startsAt: daysFromNowIso(-14), endsAt: daysFromNowIso(-7), priority: 5, isPublished: true, updatedAt: daysFromNowIso(-14) },
    { id: "feat_06", title: "Detty December picks", subtitle: "Draft for the holiday campaign", kind: "HERO_BANNER", imageId: "mart:heroBanner", targetType: "URL", targetValue: "https://zudomart.com/mart/detty-december", countries: ["NG", "GH", "GB"], startsAt: daysFromNowIso(60), endsAt: daysFromNowIso(95), priority: 6, isPublished: false, updatedAt: daysFromNowIso(-1) },
  ];
}
