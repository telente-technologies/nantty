import { buildIsoDateDaysAgo } from "@/mocks/seed/seededRandom.mock";
import type { AffiliateCreator, AffiliateCreatorStatus, AffiliateProgramSettings, AffiliateRequest, LiveInvitation } from "@/types/affiliate.type";

export interface HistoricalCommissionSeed {
  readonly id: string;
  readonly orderNumber: string;
  readonly creatorId: string;
  readonly orderTotalMinor: number;
  readonly commissionMinor: number;
  readonly orderedDaysAgo: number;
}

export interface AffiliatesMockState {
  settings: AffiliateProgramSettings;
  directory: AffiliateCreator[];
  approvedCreators: Map<string, { status: AffiliateCreatorStatus; clicks: number; approvedAt: string }>;
  requests: AffiliateRequest[];
  productOverrides: Map<string, { commissionBasisPoints: number | null; excluded: boolean }>;
  historicalCommissions: HistoricalCommissionSeed[];
  liveInvitations: LiveInvitation[];
}

export function buildDemoCreatorDirectory(): AffiliateCreator[] {
  return [
    { id: "usr_cr1", username: "stylewithtemi", name: "Temitope Adeniyi", followers: 184_000, niche: "Fashion", avatarUrl: null },
    { id: "usr_cr2", username: "techbro.dami", name: "Damilare Ojo", followers: 96_500, niche: "Gadgets", avatarUrl: null },
    { id: "usr_cr3", username: "glowwithada", name: "Adaora Eze", followers: 212_000, niche: "Beauty", avatarUrl: null },
    { id: "usr_cr4", username: "lagosfoodie", name: "Kemi Olatunji", followers: 58_300, niche: "Food", avatarUrl: null },
    { id: "usr_cr5", username: "abujahomes.ng", name: "Fatima Sule", followers: 41_200, niche: "Home", avatarUrl: null },
    { id: "usr_cr6", username: "kingsley.fits", name: "Kingsley Nwachukwu", followers: 33_900, niche: "Fashion", avatarUrl: null },
    { id: "usr_cr7", username: "unboxwithtobi", name: "Tobi Ajayi", followers: 127_800, niche: "Gadgets", avatarUrl: null },
    { id: "usr_cr8", username: "naijaskincare", name: "Chiamaka Obi", followers: 74_600, niche: "Beauty", avatarUrl: null },
  ];
}

export function buildDemoAffiliatesState(): AffiliatesMockState {
  const directory = buildDemoCreatorDirectory();
  const findCreator = (creatorId: string): AffiliateCreator => directory.find((creator) => creator.id === creatorId) ?? directory[0]!;
  return {
    settings: { enabled: true, defaultCommissionBasisPoints: 800, autoApproveCreatorsWithFollowersAbove: null, cookieWindowDays: 7 },
    directory,
    approvedCreators: new Map([
      ["usr_cr1", { status: "active", clicks: 4_812, approvedAt: buildIsoDateDaysAgo(80) }],
      ["usr_cr2", { status: "active", clicks: 2_390, approvedAt: buildIsoDateDaysAgo(64) }],
      ["usr_cr3", { status: "active", clicks: 1_104, approvedAt: buildIsoDateDaysAgo(30) }],
      ["usr_cr6", { status: "paused", clicks: 312, approvedAt: buildIsoDateDaysAgo(50) }],
    ]),
    requests: [
      { id: "afr_1", creator: findCreator("usr_cr7"), message: "I review gadgets every week and my audience loves earbuds. Would love to feature yours.", requestedAt: buildIsoDateDaysAgo(1, 9), status: "pending", decisionReason: null },
      { id: "afr_2", creator: findCreator("usr_cr8"), message: "Your face serum fits my skincare routine series.", requestedAt: buildIsoDateDaysAgo(2, 15), status: "pending", decisionReason: null },
      { id: "afr_3", creator: findCreator("usr_cr4"), message: "Can I feature your zobo and chin chin in my food clips?", requestedAt: buildIsoDateDaysAgo(3, 11), status: "pending", decisionReason: null },
      { id: "afr_4", creator: findCreator("usr_cr3"), message: "Beauty creator in Lagos, 200k followers.", requestedAt: buildIsoDateDaysAgo(31, 10), status: "approved", decisionReason: null },
      { id: "afr_5", creator: findCreator("usr_cr5"), message: "Home decor creator in Abuja.", requestedAt: buildIsoDateDaysAgo(20, 10), status: "declined", decisionReason: "We are not promoting home items this quarter." },
    ],
    productOverrides: new Map([
      ["prod_face_serum", { commissionBasisPoints: 1200, excluded: false }],
      ["prod_earbuds", { commissionBasisPoints: 600, excluded: false }],
      ["prod_watermelon", { commissionBasisPoints: null, excluded: true }],
    ]),
    historicalCommissions: [
      { id: "cml_h1", orderNumber: "ZM-57940", creatorId: "usr_cr1", orderTotalMinor: 6_050_000, commissionMinor: 440_000, orderedDaysAgo: 58 },
      { id: "cml_h2", orderNumber: "ZM-57988", creatorId: "usr_cr2", orderTotalMinor: 4_950_000, commissionMinor: 360_000, orderedDaysAgo: 52 },
      { id: "cml_h3", orderNumber: "ZM-58012", creatorId: "usr_cr1", orderTotalMinor: 2_300_000, commissionMinor: 148_000, orderedDaysAgo: 49 },
      { id: "cml_h4", orderNumber: "ZM-58077", creatorId: "usr_cr6", orderTotalMinor: 4_650_000, commissionMinor: 336_000, orderedDaysAgo: 47 },
      { id: "cml_h5", orderNumber: "ZM-58101", creatorId: "usr_cr3", orderTotalMinor: 2_950_000, commissionMinor: 300_000, orderedDaysAgo: 28 },
    ],
    liveInvitations: [
      { id: "liv_1", creator: findCreator("usr_cr1"), products: [{ id: "prod_adire_shirt", name: "Adire Oxford Shirt", imageUrl: null }, { id: "prod_bomber", name: "Rust Bomber Jacket", imageUrl: null }], proposedStartAt: buildIsoDateDaysAgo(-3, 18), commissionBasisPoints: 1000, message: "Friday evening style live?", status: "accepted", createdAt: buildIsoDateDaysAgo(2) },
      { id: "liv_2", creator: findCreator("usr_cr2"), products: [{ id: "prod_earbuds", name: "Wireless Earbuds", imageUrl: null }], proposedStartAt: buildIsoDateDaysAgo(-6, 19), commissionBasisPoints: null, message: "Unboxing live for the new earbuds batch.", status: "pending", createdAt: buildIsoDateDaysAgo(1) },
      { id: "liv_3", creator: findCreator("usr_cr3"), products: [{ id: "prod_face_serum", name: "Glow Face Serum 30ml", imageUrl: null }], proposedStartAt: buildIsoDateDaysAgo(12, 18), commissionBasisPoints: 1200, message: "Skincare night.", status: "ended", createdAt: buildIsoDateDaysAgo(20) },
    ],
  };
}
