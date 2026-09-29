import { shiftTimestampByDays } from "@/mocks/seed/seededRandom.mock";
import type { CustomAudience } from "@/types/audience.type";

function buildAudience(audience: Omit<CustomAudience, "createdAt" | "updatedAt" | "usedInAdSetCount"> & { daysAgo: number; usedIn: number }): CustomAudience {
  const { daysAgo, usedIn, ...rest } = audience;
  return { ...rest, usedInAdSetCount: usedIn, createdAt: shiftTimestampByDays(-daysAgo), updatedAt: shiftTimestampByDays(-Math.min(daysAgo, 1)) };
}

export function buildDemoCustomAudiences(): CustomAudience[] {
  return [
    buildAudience({ id: "aud_ife_customers", accountId: "act_ifelifestyle", name: "Store customers — last 180 days", type: "store_customers", status: "ready", approximateSize: { lower: 4_200, upper: 4_900 }, retentionDays: 180, description: "People who completed an order in the Ife Lifestyle store.", lookalike: null, daysAgo: 90, usedIn: 1 }),
    buildAudience({ id: "aud_ife_engagers", accountId: "act_ifelifestyle", name: "Engaged with posts or reels — 60 days", type: "engagers", status: "ready", approximateSize: { lower: 38_000, upper: 44_000 }, retentionDays: 60, description: "Liked, commented, saved or watched 50% of a reel.", lookalike: null, daysAgo: 45, usedIn: 1 }),
    buildAudience({ id: "aud_ife_followers", accountId: "act_ifelifestyle", name: "Followers of @ifelifestyle", type: "followers", status: "ready", approximateSize: { lower: 21_000, upper: 23_500 }, retentionDays: null, description: "Everyone who follows the profile.", lookalike: null, daysAgo: 120, usedIn: 0 }),
    buildAudience({ id: "aud_ife_lookalike", accountId: "act_ifelifestyle", name: "Lookalike 3% (NG) — store customers", type: "lookalike", status: "ready", approximateSize: { lower: 1_050_000, upper: 1_240_000 }, retentionDays: null, description: "People in Nigeria most similar to your store customers.", lookalike: { sourceAudienceId: "aud_ife_customers", countryCode: "NG", similarityPercent: 3 }, daysAgo: 60, usedIn: 1 }),
    buildAudience({ id: "aud_ife_vip_list", accountId: "act_ifelifestyle", name: "VIP WhatsApp list (hashed)", type: "customer_list", status: "too_small", approximateSize: { lower: 300, upper: 600 }, retentionDays: null, description: "Uploaded customer list, matched by hashed phone numbers.", lookalike: null, daysAgo: 12, usedIn: 0 }),
    buildAudience({ id: "aud_kk_customers", accountId: "act_kelechikicks", name: "Sneaker buyers — 90 days", type: "store_customers", status: "ready", approximateSize: { lower: 1_900, upper: 2_300 }, retentionDays: 90, description: "Completed orders in Kelechi Kicks.", lookalike: null, daysAgo: 30, usedIn: 0 }),
    buildAudience({ id: "aud_kente_followers", accountId: "act_kenteheritage", name: "Followers of @kente.heritage", type: "followers", status: "ready", approximateSize: { lower: 6_400, upper: 7_100 }, retentionDays: null, description: "Everyone who follows the profile.", lookalike: null, daysAgo: 40, usedIn: 0 }),
  ];
}
