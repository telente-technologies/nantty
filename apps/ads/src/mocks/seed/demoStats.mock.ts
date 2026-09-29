import type { MockAdRecord, MockAdSetRecord, MockCampaignRecord } from "@/mocks/mockDatabase.mock";
import { createSeededRandomNumberGenerator, pickBetween, shiftIsoDateByDays } from "@/mocks/seed/seededRandom.mock";
import type { CampaignObjective } from "@/types/campaign.type";

export interface MockDailyStat {
  readonly adId: string;
  readonly date: string;
  readonly impressions: number;
  readonly reach: number;
  readonly clicks: number;
  readonly spendMinor: number;
  readonly conversions: number;
  readonly conversionValueMinor: number;
  readonly videoViews: number;
  readonly watchPercentTotal: number;
  readonly followersGained: number;
  readonly conversationsStarted: number;
}

export const costPerThousandMajorByCurrency: Record<string, readonly [number, number]> = { NGN: [520, 1450], GHS: [6, 16], KES: [70, 190], ZAR: [9, 24], GBP: [2, 5], EUR: [2, 5], USD: [2, 6] };
export const clickRateByObjective: Record<CampaignObjective, number> = { awareness: 0.006, traffic: 0.019, engagement: 0.024, messages: 0.014, sales: 0.013, followers: 0.017, store_promotion: 0.018 };
const costMultiplierByObjective: Record<CampaignObjective, number> = { awareness: 0.55, traffic: 0.8, engagement: 0.7, messages: 0.9, sales: 1, followers: 0.75, store_promotion: 0.85 };

function readActiveDateRange(campaign: MockCampaignRecord): { from: string; to: string } | null {
  if (!["active", "paused", "completed"].includes(campaign.status)) return null;
  const yesterday = shiftIsoDateByDays(-1);
  const from = campaign.schedule.startAt.slice(0, 10);
  let to = campaign.schedule.endAt ? campaign.schedule.endAt.slice(0, 10) : yesterday;
  if (to > yesterday) to = yesterday;
  if (campaign.status === "paused") to = shiftIsoDateByDays(-4);
  return from <= to ? { from, to } : null;
}

function readDailySpendBudgetMinor(campaign: MockCampaignRecord, adSets: readonly MockAdSetRecord[], range: { from: string; to: string }): number {
  if (campaign.budget?.type === "daily") return campaign.budget.amount.amountMinor;
  if (campaign.budget?.type === "lifetime") {
    const days = Math.max(1, Math.round((Date.parse(range.to) - Date.parse(range.from)) / 86_400_000) + 1);
    return Math.round((campaign.budget.amount.amountMinor * 0.96) / days);
  }
  return adSets.reduce((total, adSet) => total + (adSet.budget?.amount.amountMinor ?? 0), 0);
}

export function generateDailyStatsForAds(campaigns: readonly MockCampaignRecord[], adSets: readonly MockAdSetRecord[], ads: readonly MockAdRecord[]): MockDailyStat[] {
  const stats: MockDailyStat[] = [];
  for (const campaign of campaigns) {
    const range = readActiveDateRange(campaign);
    if (!range) continue;
    const campaignAdSets = adSets.filter((adSet) => adSet.campaignId === campaign.id);
    const campaignAds = ads.filter((ad) => ad.campaignId === campaign.id && ad.review.status === "approved");
    if (campaignAds.length === 0) continue;
    const dailyBudgetMinor = readDailySpendBudgetMinor(campaign, campaignAdSets, range);
    const currency = campaign.budget?.amount.currency ?? campaignAdSets[0]?.budget?.amount.currency ?? "NGN";
    const [cpmLow, cpmHigh] = costPerThousandMajorByCurrency[currency] ?? [2, 6];
    const random = createSeededRandomNumberGenerator(campaign.id);
    const adWeights = campaignAds.map(() => pickBetween(random, 0.6, 1.4));
    const weightTotal = adWeights.reduce((sum, weight) => sum + weight, 0);
    for (let date = range.from; date <= range.to; date = shiftIsoDateByDays(1, new Date(`${date}T00:00:00Z`))) {
      const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
      const weekendLift = weekday === 0 || weekday === 6 ? 1.12 : 1;
      const dayPacing = pickBetween(random, 0.82, 0.99);
      campaignAds.forEach((ad, adIndex) => {
        const spendMinor = Math.round(dailyBudgetMinor * dayPacing * ((adWeights[adIndex] ?? 1) / weightTotal));
        const costPerThousandMinor = pickBetween(random, cpmLow, cpmHigh) * 100 * costMultiplierByObjective[campaign.objective];
        const impressions = Math.round((spendMinor / costPerThousandMinor) * 1000 * weekendLift);
        const reach = Math.round(impressions / pickBetween(random, 1.25, 1.9));
        const clicks = Math.round(impressions * clickRateByObjective[campaign.objective] * pickBetween(random, 0.75, 1.3));
        const isSales = campaign.objective === "sales";
        const conversions = Math.round(clicks * (isSales ? pickBetween(random, 0.006, 0.012) : pickBetween(random, 0.0005, 0.002)));
        const averageOrderMinor = ad.creative.product?.price.amountMinor ?? (currency === "NGN" ? 2_200_000 : 30_000);
        const isVideo = ad.creative.media.some((media) => media.kind === "video");
        const videoViews = isVideo ? Math.round(impressions * pickBetween(random, 0.28, 0.46)) : 0;
        stats.push({
          adId: ad.id,
          date,
          impressions,
          reach,
          clicks,
          spendMinor,
          conversions,
          conversionValueMinor: Math.round(conversions * averageOrderMinor * pickBetween(random, 0.9, 1.35)),
          videoViews,
          watchPercentTotal: Math.round(videoViews * pickBetween(random, 34, 61)),
          followersGained: Math.round(clicks * (campaign.objective === "followers" ? pickBetween(random, 0.25, 0.4) : pickBetween(random, 0.01, 0.04))),
          conversationsStarted: Math.round(clicks * (campaign.objective === "messages" ? pickBetween(random, 0.18, 0.3) : 0)),
        });
      });
    }
  }
  return stats;
}
