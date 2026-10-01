import type { CreatorAffiliation, CreatorEarning, CreatorTopContent } from "@/types/creator.type";

import { demoFanAccount, getSignedInMockUser, isoDateHoursAgo } from "./fixtures.mock";
import { convertUsdCentsToViewerCurrency } from "./locale.mock";
import { postImageUrlsForPhotoKey, productImageUrlsForProduct } from "./mockImages.mock";
import { productSummaryByKey } from "./productCatalog.mock";
import { storeSummaryById } from "./storeDirectory.mock";

export interface MockCreatorEarningRecord {
  readonly id: string;
  readonly source: CreatorEarning["source"];
  readonly description: string;
  readonly usdCents: number;
  readonly hoursAgo: number;
  readonly releasesInHours: number | null;
}

export const creatorEarningRecords: readonly MockCreatorEarningRecord[] = [
  { id: "ce_1", source: "gift", description: "Gifts · Friday live: 5 clay-pot recipes", usdCents: 4_860, hoursAgo: 30, releasesInHours: null },
  { id: "ce_2", source: "affiliate_commission", description: "Commission · Vitamin C Glow Serum (Glow by Zainab)", usdCents: 380, hoursAgo: 20, releasesInHours: 52 },
  { id: "ce_3", source: "affiliate_commission", description: "Commission · 20,000mAh Power Bank (TundeTech)", usdCents: 290, hoursAgo: 44, releasesInHours: 28 },
  { id: "ce_4", source: "gift", description: "Gifts · Market run with Mama Nkechi", usdCents: 2_150, hoursAgo: 170, releasesInHours: null },
  { id: "ce_5", source: "affiliate_commission", description: "Commission · Ankara Wrap Midi Dress (Adaeze Styles)", usdCents: 610, hoursAgo: 220, releasesInHours: null },
  { id: "ce_6", source: "bonus", description: "Rising Creator bonus · September", usdCents: 5_000, hoursAgo: 400, releasesInHours: null },
  { id: "ce_7", source: "affiliate_commission", description: "Commission · Whipped Shea Body Butter (Glow by Zainab)", usdCents: 150, hoursAgo: 6, releasesInHours: 70 },
  { id: "ce_8", source: "gift", description: "Gifts · Sunday home tour live", usdCents: 3_320, hoursAgo: 520, releasesInHours: null },
];

export const signedInUserIsApprovedCreator = () => getSignedInMockUser().id !== demoFanAccount.id;

export const presentCreatorEarning = (record: MockCreatorEarningRecord): CreatorEarning => ({
  id: record.id,
  source: record.source,
  description: record.description,
  amount: convertUsdCentsToViewerCurrency(record.usdCents),
  status: record.releasesInHours === null ? "available" : "pending",
  availableAt: record.releasesInHours === null ? null : isoDateHoursAgo(-record.releasesInHours),
  createdAt: isoDateHoursAgo(record.hoursAgo),
});

export const creatorEarningsUsdCentsByStatus = () => {
  if (!signedInUserIsApprovedCreator()) return { availableUsdCents: 0, pendingUsdCents: 0 };
  return creatorEarningRecords.reduce(
    (totals, record) =>
      record.releasesInHours === null
        ? { ...totals, availableUsdCents: totals.availableUsdCents + record.usdCents }
        : { ...totals, pendingUsdCents: totals.pendingUsdCents + record.usdCents },
    { availableUsdCents: 0, pendingUsdCents: 0 },
  );
};

export const buildCreatorTopContent = (): CreatorTopContent[] => [
  { id: "live_top_1", kind: "live", title: "Friday live: 5 clay-pot recipes", thumbnailUrl: productImageUrlsForProduct("h2")[0] ?? null, views: 18_400, earnings: convertUsdCentsToViewerCurrency(4_860) },
  { id: "post_9", kind: "post", title: "Sunday pots 🏺 fresh from our potters", thumbnailUrl: productImageUrlsForProduct("h1")[0] ?? null, views: 9_800, earnings: convertUsdCentsToViewerCurrency(640) },
  { id: "live_top_2", kind: "live", title: "Market run with Mama Nkechi", thumbnailUrl: postImageUrlsForPhotoKey("streetMarket")[0] ?? null, views: 7_200, earnings: convertUsdCentsToViewerCurrency(2_150) },
];

interface MockAffiliationRecord {
  id: string;
  storeId: string;
  productKey: Parameters<typeof productSummaryByKey>[0] | null;
  commissionPercent: number;
  status: CreatorAffiliation["status"];
  salesCount: number;
  earnedUsdCents: number;
}

export const creatorAffiliationRecords: MockAffiliationRecord[] = [
  { id: "af_1", storeId: "s_glow", productKey: "b3", commissionPercent: 10, status: "active", salesCount: 14, earnedUsdCents: 2_660 },
  { id: "af_2", storeId: "s_tunde", productKey: "g2", commissionPercent: 6, status: "active", salesCount: 9, earnedUsdCents: 1_300 },
  { id: "af_3", storeId: "s_ada", productKey: null, commissionPercent: 8, status: "active", salesCount: 5, earnedUsdCents: 1_520 },
  { id: "af_4", storeId: "s_kicks", productKey: "s1", commissionPercent: 7, status: "requested", salesCount: 0, earnedUsdCents: 0 },
];

export const presentAffiliation = (record: MockAffiliationRecord): CreatorAffiliation => ({
  id: record.id,
  store: storeSummaryById(record.storeId),
  product: record.productKey ? productSummaryByKey(record.productKey) : null,
  commissionPercent: record.commissionPercent,
  status: record.status,
  salesCount: record.salesCount,
  earned: convertUsdCentsToViewerCurrency(record.earnedUsdCents),
});
