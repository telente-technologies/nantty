import type { MockPlatformUserRecord } from "@/mocks/seed/demoPlatformUsers.mock";
import type { ApplicationKind, ApplicationStatus, EligibilityCheck } from "@/types/applications.type";

export interface MockProgramApplicationRecord {
  id: string;
  kind: ApplicationKind;
  userId: string;
  status: ApplicationStatus;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedByName: string | null;
  decisionReason: string | null;
  pitch: string;
  storeName: string | null;
  categories: string[];
  expectedMonthlySalesMajor: number | null;
  contentNiche: string | null;
  sellerSignals: { kycVerified: boolean; bankAccountVerified: boolean; businessDocumentsProvided: boolean; prohibitedCategoryHits: string[] } | null;
  creatorSignals: { postsLast30Days: number; averageViewsPerClip: number } | null;
}

export const creatorProgramThresholds = { minimumFollowers: 1_000, minimumPostsLast30Days: 8, maximumActiveStrikes: 0, minimumAccountAgeDays: 30 } as const;

interface SellerSeed {
  readonly username: string;
  readonly status: ApplicationStatus;
  readonly daysAgo: number;
  readonly storeName: string;
  readonly categories: string[];
  readonly volume: number;
  readonly pitch: string;
  readonly kyc?: boolean;
  readonly bank?: boolean;
  readonly documents?: boolean;
  readonly prohibited?: string[];
}

interface CreatorSeed {
  readonly username: string;
  readonly status: ApplicationStatus;
  readonly daysAgo: number;
  readonly niche: string;
  readonly posts: number;
  readonly views: number;
  readonly pitch: string;
}

const sellerSeeds: readonly SellerSeed[] = [
  { username: "segun.snaps", status: "PENDING", daysAgo: 0.6, storeName: "Segun Camera Hub", categories: ["Cameras", "Photography accessories"], volume: 1_800_000, pitch: "I sell tested second-hand cameras and lenses with a 30-day warranty." },
  { username: "ifeoma.art", status: "PENDING", daysAgo: 1.4, storeName: "Ifeoma Art Prints", categories: ["Art & prints", "Home decor"], volume: 650_000, pitch: "Limited-edition prints of my paintings, shipped framed." },
  { username: "sipho.fits", status: "PENDING", daysAgo: 2.2, storeName: "Sipho Fits Supplements", categories: ["Fitness", "Supplements"], volume: 22_000, pitch: "Protein and pre-workout for my followers.", kyc: false, prohibited: ["Unregistered supplements"] },
  { username: "ken.otieno", status: "PENDING", daysAgo: 3.1, storeName: "Otieno Crafts", categories: ["Handmade", "Home decor"], volume: 90_000, pitch: "Soapstone carvings from Kisii artisans.", bank: false },
  { username: "fake.dangote.official", status: "REJECTED", daysAgo: 12, storeName: "Dangote Giveaway Store", categories: ["Electronics"], volume: 50_000_000, pitch: "Official Dangote promo store.", kyc: false, documents: false },
];

const creatorSeeds: readonly CreatorSeed[] = [
  { username: "jide.kicks", status: "PENDING", daysAgo: 0.3, niche: "Sneaker reviews and cop-or-drop", posts: 22, views: 18_400, pitch: "Weekly sneaker drops and live unboxings with my followers." },
  { username: "ngozi_bakes", status: "PENDING", daysAgo: 0.9, niche: "Baking tutorials", posts: 14, views: 7_900, pitch: "Live baking classes on Saturdays; I want to earn from gifts." },
  { username: "grace.decor", status: "PENDING", daysAgo: 1.7, niche: "Home makeovers on a budget", posts: 11, views: 3_100, pitch: "Room makeover series for Lagos apartments." },
  { username: "emeka.gadgets", status: "PENDING", daysAgo: 2.5, niche: "Phone reviews", posts: 30, views: 5_600, pitch: "Honest reviews of phones sold in Computer Village." },
  { username: "segun.snaps", status: "PENDING", daysAgo: 4, niche: "Street photography", posts: 5, views: 900, pitch: "Photo walks around Lagos Island." },
];

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function convertMajorAmountForCurrency(majorInNaira: number, currency: string): number {
  const nairaPerUnit: Record<string, number> = { NGN: 1, GHS: 105, KES: 12, ZAR: 85, GBP: 2_050, USD: 1_600 };
  return Math.max(1, Math.round(majorInNaira / (nairaPerUnit[currency] ?? 1_600)));
}

export function buildDemoProgramApplications(users: readonly MockPlatformUserRecord[]): MockProgramApplicationRecord[] {
  const findUser = (username: string) => users.find((candidate) => candidate.username === username);
  const records: MockProgramApplicationRecord[] = [];
  sellerSeeds.forEach((seed, index) => {
    const user = findUser(seed.username);
    if (!user) return;
    const isReviewed = seed.status !== "PENDING";
    records.push({
      id: `sap_${String(index + 1).padStart(4, "0")}`, kind: "sellers", userId: user.id, status: seed.status, submittedAt: daysAgoIso(seed.daysAgo),
      reviewedAt: isReviewed ? daysAgoIso(seed.daysAgo - 1) : null, reviewedByName: isReviewed ? "Chidi Okafor" : null, decisionReason: isReviewed ? "Impersonation of a registered brand; KYC failed." : null,
      pitch: seed.pitch, storeName: seed.storeName, categories: [...seed.categories], expectedMonthlySalesMajor: convertMajorAmountForCurrency(seed.volume, user.currency), contentNiche: null,
      sellerSignals: { kycVerified: seed.kyc ?? true, bankAccountVerified: seed.bank ?? true, businessDocumentsProvided: seed.documents ?? true, prohibitedCategoryHits: seed.prohibited ?? [] },
      creatorSignals: null,
    });
  });
  creatorSeeds.forEach((seed, index) => {
    const user = findUser(seed.username);
    if (!user) return;
    records.push({
      id: `cap_${String(index + 1).padStart(4, "0")}`, kind: "creators", userId: user.id, status: seed.status, submittedAt: daysAgoIso(seed.daysAgo),
      reviewedAt: null, reviewedByName: null, decisionReason: null, pitch: seed.pitch, storeName: null, categories: [], expectedMonthlySalesMajor: null, contentNiche: seed.niche,
      sellerSignals: null, creatorSignals: { postsLast30Days: seed.posts, averageViewsPerClip: seed.views },
    });
  });
  return records;
}

export function evaluateApplicationEligibility(record: MockProgramApplicationRecord, user: MockPlatformUserRecord): EligibilityCheck[] {
  if (record.sellerSignals) {
    const signals = record.sellerSignals;
    return [
      { key: "kyc", label: "Identity (NIN/BVN) verified", isMet: signals.kycVerified, actual: signals.kycVerified ? "Verified" : "Not verified", required: "Verified" },
      { key: "bank", label: "Payout bank account verified", isMet: signals.bankAccountVerified, actual: signals.bankAccountVerified ? "Name match" : "Name mismatch", required: "Name match" },
      { key: "documents", label: "Business documents", isMet: signals.businessDocumentsProvided, actual: signals.businessDocumentsProvided ? "Provided" : "Missing", required: "CAC or ID + address" },
      { key: "prohibited", label: "Prohibited categories", isMet: signals.prohibitedCategoryHits.length === 0, actual: signals.prohibitedCategoryHits.join(", ") || "None", required: "None" },
      { key: "standing", label: "Account standing", isMet: user.status === "ACTIVE", actual: user.status, required: "ACTIVE" },
    ];
  }
  const signals = record.creatorSignals ?? { postsLast30Days: 0, averageViewsPerClip: 0 };
  const accountAgeDays = Math.floor((Date.now() - Date.parse(user.joinedAt)) / 86_400_000);
  return [
    { key: "followers", label: "Followers", isMet: user.followerCount >= creatorProgramThresholds.minimumFollowers, actual: user.followerCount.toLocaleString("en-NG"), required: `≥ ${creatorProgramThresholds.minimumFollowers.toLocaleString("en-NG")}` },
    { key: "posts", label: "Posts in last 30 days", isMet: signals.postsLast30Days >= creatorProgramThresholds.minimumPostsLast30Days, actual: String(signals.postsLast30Days), required: `≥ ${creatorProgramThresholds.minimumPostsLast30Days}` },
    { key: "strikes", label: "Active strikes", isMet: user.strikeCount <= creatorProgramThresholds.maximumActiveStrikes, actual: String(user.strikeCount), required: `≤ ${creatorProgramThresholds.maximumActiveStrikes}` },
    { key: "age", label: "Account age", isMet: accountAgeDays >= creatorProgramThresholds.minimumAccountAgeDays, actual: `${accountAgeDays} days`, required: `≥ ${creatorProgramThresholds.minimumAccountAgeDays} days` },
  ];
}
