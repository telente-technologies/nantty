import { buildIsoDateDaysAgo } from "@/mocks/seed/seededRandom.mock";
import type { BrandClaim, BrandMember, BrandOfficialStore, BrandRegistration, ProductBrandRelationship } from "@/types/brand.type";

export interface MockBrandRecord {
  readonly id: string;
  name: string;
  readonly handle: string;
  logoUrl: string | null;
  coverUrl: string | null;
  description: string;
  website: string | null;
  readonly country: string;
  registration: BrandRegistration;
  officialStore: BrandOfficialStore;
  members: BrandMember[];
  storeIds: string[];
  sellingEnabled?: boolean;
}

export interface MockBrandListing {
  readonly id: string;
  readonly brandId: string;
  readonly sellerName: string;
  readonly sellerHandle: string;
  readonly title: string;
  readonly imageUrl: string | null;
  readonly priceMinor: number;
  readonly matchedProductId: string | null;
  readonly relationshipClaimed: ProductBrandRelationship;
  readonly sellerAccountAgeDays: number;
  readonly listedAt: string;
  openClaimId: string | null;
}

export interface BrandsMockState {
  brands: MockBrandRecord[];
  listings: MockBrandListing[];
  claims: BrandClaim[];
}

const unregistered: BrandRegistration = { status: "unregistered", trademarkNumber: null, registeredAt: null, note: null };
const notOfficial: BrandOfficialStore = { status: "not_eligible", storeId: null, reason: null };

function buildRegisteredBrand(id: string, name: string, handle: string, description: string, trademarkNumber: string): MockBrandRecord {
  return {
    id, name, handle, logoUrl: null, coverUrl: null, description, website: null, country: "NG",
    registration: { status: "registered", trademarkNumber, registeredAt: buildIsoDateDaysAgo(400), note: null },
    officialStore: { status: "active", storeId: null, reason: null },
    members: [], storeIds: [],
  };
}

function buildDemoBrandRecords(): MockBrandRecord[] {
  return [
    {
      id: "brand_ife_lifestyle",
      name: "Ìfẹ́ Lifestyle",
      handle: "ife.lifestyle",
      logoUrl: null,
      coverUrl: "https://images.unsplash.com/photo-1603006905003-be475563bc59?w=800&q=80&fm=webp",
      description: "Everyday fashion, adire pieces and home scents designed in Lagos. Made in small batches and sold in our Lekki, Ikeja and Abuja stores and on Nantty.",
      website: "https://ifelifestyle.ng",
      country: "NG",
      registration: { status: "registered", trademarkNumber: "NG/TM/O/2025/118042", registeredAt: buildIsoDateDaysAgo(210), note: null },
      officialStore: { status: "active", storeId: "store_ife_lifestyle", reason: null },
      members: [
        { id: "bmem_adaeze", userId: "usr_adaeze", name: "Adaeze Okafor", username: "adaeze.okafor", role: "owner", status: "active" },
        { id: "bmem_tunde", userId: "usr_tunde", name: "Tunde Bakare", username: "tunde.bakare", role: "admin", status: "active" },
        { id: "bmem_ngozi", userId: "usr_ngozi", name: "Ngozi Nwosu", username: "ngozi.nwosu", role: "editor", status: "active" },
      ],
      storeIds: ["store_ife_lifestyle"],
    },
    {
      id: "brand_adire_lab",
      name: "Adire Lab",
      handle: "adirelab",
      logoUrl: null,
      coverUrl: null,
      description: "Hand-dyed adire fabric and ready-to-wear by the Ìfẹ́ Lifestyle team, sold through our Adire Lab Studio store.",
      website: null,
      country: "NG",
      registration: { status: "pending", trademarkNumber: null, registeredAt: null, note: "Trademark application NG/TM/O/2026/042211 is with the registry. We will update you when it is granted." },
      officialStore: notOfficial,
      members: [{ id: "bmem_adaeze_adire", userId: "usr_adaeze", name: "Adaeze Okafor", username: "adaeze.okafor", role: "owner", status: "active" }],
      storeIds: ["store_adire_lab_studio"],
    },
    buildRegisteredBrand("brand_kano_leather", "Kano Leatherworks", "kanoleatherworks", "Tanned and stitched in Kano: bags, sandals and belts.", "NG/TM/O/2023/077310"),
    buildRegisteredBrand("brand_lekki_glow", "Lekki Glow Cosmetics", "lekkiglow", "Skincare made for West African skin and weather.", "NG/TM/O/2024/093155"),
    buildRegisteredBrand("brand_oja_tech", "Ọjà Tech", "ojatech", "Everyday audio and power accessories with a two-year warranty.", "NG/TM/O/2022/051904"),
    buildRegisteredBrand("brand_yaba_denim", "Yaba Denim Co.", "yabadenim", "Denim cut and sewn in Yaba.", "NG/TM/O/2024/101887"),
    { ...buildRegisteredBrand("brand_abeokuta_collective", "Abeokuta Adire Collective", "abeokutaadire", "A co-operative of adire dyers in Itoku.", ""), registration: unregistered, officialStore: notOfficial },
  ];
}

function buildDemoBrandListings(): MockBrandListing[] {
  const rows: [string, string, string, string | null, number, string | null, ProductBrandRelationship, number, number][] = [
    ["Tobi Styles Hub", "tobistyleshub", "Ìfẹ́ Lifestyle Adire Oxford Shirt (all sizes)", "1602810318383-e386cc2a3ccf", 650_000, "prod_adire_shirt", "own", 12, 2],
    ["Mama Chi Wholesale", "mamachi.wholesale", "Adire Oxford Shirt — Ìfẹ́ Lifestyle original", "1602810318383-e386cc2a3ccf", 900_000, "prod_adire_shirt", "genuine_resale", 45, 5],
    ["Candle Corner Abuja", "candlecorner.abj", "Lagos Rain Scented Candle by Ìfẹ́ Lifestyle", "1603006905003-be475563bc59", 850_000, "prod_candle", "genuine_resale", 380, 9],
    ["Gift Box Naija", "giftboxnaija", "Ìfẹ́ Lifestyle candle + tote gift set", "1603006905003-be475563bc59", 1_750_000, "prod_candle", "authorised_reseller", 610, 14],
    ["Deals4Less", "deals4less_ng", "Ìfẹ́ adire tote bag (factory price)", null, 200_000, "prod_adire_tote", "own", 3, 1],
    ["Ada's Closet", "adascloset", "Pre-loved Ìfẹ́ Lifestyle adire shirt, size M", "1602810318383-e386cc2a3ccf", 1_100_000, "prod_adire_shirt", "genuine_resale", 900, 20],
    ["Lagos Bargains", "lagosbargains", "Ìfẹ́ Lifestyle Everyday Crew Tee — 3 for ₦10k", "1618354691373-d851c5c3a990", 333_300, "prod_crew_tee", "own", 8, 3],
    ["Uyo Home Scents", "uyohomescents", "Lagos Rain candle (Ìfẹ́ Lifestyle)", "1603006905003-be475563bc59", 950_000, "prod_candle", "genuine_resale", 240, 30],
  ];
  return rows.map(([sellerName, sellerHandle, title, photoId, priceMinor, matchedProductId, relationshipClaimed, sellerAccountAgeDays, daysAgo], index) => ({
    id: `lst_${String(index + 1).padStart(3, "0")}`,
    brandId: "brand_ife_lifestyle",
    sellerName,
    sellerHandle,
    title,
    imageUrl: photoId ? `https://images.unsplash.com/photo-${photoId}?w=800&q=80&fm=webp` : null,
    priceMinor,
    matchedProductId,
    relationshipClaimed,
    sellerAccountAgeDays,
    listedAt: buildIsoDateDaysAgo(daysAgo, 11),
    openClaimId: index === 4 ? "bclm_001" : null,
  }));
}

function buildDemoBrandClaims(): BrandClaim[] {
  return [
    {
      id: "bclm_001",
      brandId: "brand_ife_lifestyle",
      kind: "counterfeit",
      listings: [{ listingId: "lst_005", title: "Ìfẹ́ adire tote bag (factory price)", sellerHandle: "deals4less_ng" }],
      evidence: "We have never sold wholesale or 'factory price' totes. The photo uses our old logo and the price is below our cost. Test purchase on 20 Sept showed a printed (not dyed) fabric.",
      status: "under_review",
      createdAt: buildIsoDateDaysAgo(1, 9),
      updatedAt: buildIsoDateDaysAgo(0, 8),
      resolution: null,
    },
  ];
}

export function seedDemoBrandsMockState(): BrandsMockState {
  return { brands: buildDemoBrandRecords(), listings: buildDemoBrandListings(), claims: buildDemoBrandClaims() };
}
