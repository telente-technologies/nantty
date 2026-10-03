import type { StorefrontOpeningHours, StorefrontSocialLinks } from "@/types/storefront.type";

export interface MockStorefrontRecord {
  tagline: string;
  logoUrl: string | null;
  coverUrl: string | null;
  openingHours: StorefrontOpeningHours[];
  socialLinks: StorefrontSocialLinks;
  featuredProductIds: string[] | null;
  followerCount: number;
  averageRating: number | null;
  updatedAt: string;
}

function buildWeekdayHours(opensAt: string, closesAt: string, sundayOpen: boolean): StorefrontOpeningHours[] {
  return (["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const).map((weekday) => ({
    weekday,
    isOpen: weekday !== "sunday" || sundayOpen,
    opensAt: weekday === "saturday" ? "10:00" : weekday === "sunday" ? "13:00" : opensAt,
    closesAt: weekday === "sunday" ? "18:00" : closesAt,
  }));
}

const emptySocialLinks: StorefrontSocialLinks = { instagram: null, tiktok: null, x: null, whatsapp: null, facebook: null, website: null };

const storefrontSeedsByStoreId: Record<string, Omit<MockStorefrontRecord, "featuredProductIds" | "updatedAt">> = {
  store_ife_lifestyle: {
    tagline: "Everyday style, delivered across Nigeria",
    logoUrl: null,
    coverUrl: "/photos/boutiqueFriends.webp",
    openingHours: buildWeekdayHours("09:00", "19:00", true),
    socialLinks: { ...emptySocialLinks, instagram: "https://instagram.com/ife.lifestyle", tiktok: "https://tiktok.com/@ife.lifestyle", whatsapp: "https://wa.me/2348035550142", website: "https://ifelifestyle.ng" },
    followerCount: 18_420,
    averageRating: 4.7,
  },
  store_adire_lab_studio: {
    tagline: "Hand-dyed adire, made in Abeokuta",
    logoUrl: null,
    coverUrl: "/photos/fruitStandSeller.webp",
    openingHours: buildWeekdayHours("10:00", "18:00", false),
    socialLinks: { ...emptySocialLinks, instagram: "https://instagram.com/adirelab.studio", x: "https://x.com/adirelab", whatsapp: "https://wa.me/2348035550268" },
    followerCount: 6_310,
    averageRating: 4.8,
  },
  store_kelechi_kicks: {
    tagline: "Aba-made leather shoes that last",
    logoUrl: null,
    coverUrl: "/photos/shopkeeperPhone.webp",
    openingHours: buildWeekdayHours("08:00", "18:30", false),
    socialLinks: { ...emptySocialLinks, instagram: "https://instagram.com/kelechi.kicks", facebook: "https://facebook.com/kelechikicks" },
    followerCount: 2_940,
    averageRating: 4.5,
  },
  store_funmi_bakes: {
    tagline: "Celebration cakes and small chops in Surulere",
    logoUrl: null,
    coverUrl: "/photos/shopCounterOwner.webp",
    openingHours: buildWeekdayHours("08:00", "20:00", true),
    socialLinks: { ...emptySocialLinks, instagram: "https://instagram.com/funmibakes", tiktok: "https://tiktok.com/@funmibakes", whatsapp: "https://wa.me/2348145550166" },
    followerCount: 4_105,
    averageRating: 4.9,
  },
};

export function buildDemoStorefrontRecord(storeId: string): MockStorefrontRecord {
  const seed = storefrontSeedsByStoreId[storeId] ?? { tagline: "", logoUrl: null, coverUrl: null, openingHours: buildWeekdayHours("09:00", "18:00", false), socialLinks: emptySocialLinks, followerCount: 0, averageRating: null };
  return { ...seed, featuredProductIds: null, updatedAt: new Date(Date.now() - 4 * 86_400_000).toISOString() };
}
