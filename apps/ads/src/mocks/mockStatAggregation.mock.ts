import { readMockDatabase, type MockAdRecord, type MockAdSetRecord, type MockCampaignRecord } from "@/mocks/mockDatabase.mock";
import type { MockDailyStat } from "@/mocks/seed/demoStats.mock";
import type { CampaignObjective } from "@/types/campaign.type";
import type { ReportMetrics } from "@/types/report.type";

export interface WeightedStat {
  readonly stat: MockDailyStat;
  readonly weight: number;
  readonly ad: MockAdRecord;
  readonly adSet: MockAdSetRecord;
  readonly campaign: MockCampaignRecord;
}

export interface StatFilter {
  readonly accountId: string;
  readonly from: string | null;
  readonly to: string | null;
  readonly campaignIds?: readonly string[];
  readonly adSetIds?: readonly string[];
  readonly adIds?: readonly string[];
}

export function collectWeightedStats(filter: StatFilter): WeightedStat[] {
  const database = readMockDatabase();
  const adsById = new Map(database.ads.filter((ad) => ad.accountId === filter.accountId).map((ad) => [ad.id, ad]));
  const adSetsById = new Map(database.adSets.map((adSet) => [adSet.id, adSet]));
  const campaignsById = new Map(database.campaigns.map((campaign) => [campaign.id, campaign]));
  const collected: WeightedStat[] = [];
  for (const stat of database.dailyStats) {
    if (filter.from && stat.date < filter.from) continue;
    if (filter.to && stat.date > filter.to) continue;
    const ad = adsById.get(stat.adId);
    if (!ad) continue;
    if (filter.adIds && filter.adIds.length > 0 && !filter.adIds.includes(ad.id)) continue;
    if (filter.adSetIds && filter.adSetIds.length > 0 && !filter.adSetIds.includes(ad.adSetId)) continue;
    if (filter.campaignIds && filter.campaignIds.length > 0 && !filter.campaignIds.includes(ad.campaignId)) continue;
    const adSet = adSetsById.get(ad.adSetId);
    const campaign = campaignsById.get(ad.campaignId);
    if (adSet && campaign) collected.push({ stat, weight: 1, ad, adSet, campaign });
  }
  return collected;
}

export interface AttributionSettings {
  readonly clickWindowDays: number;
  readonly viewWindowDays: number;
}

const defaultAttribution: AttributionSettings = { clickWindowDays: 7, viewWindowDays: 1 };

function readAttributionMultiplier(settings: AttributionSettings): number {
  const clickMultiplier = settings.clickWindowDays === 1 ? 0.72 : settings.clickWindowDays === 28 ? 1.14 : 1;
  return clickMultiplier * (settings.viewWindowDays === 0 ? 0.88 : 1);
}

export function aggregateWeightedStatsIntoMetrics(weightedStats: readonly WeightedStat[], currency: string, attribution: AttributionSettings = defaultAttribution): ReportMetrics {
  let impressions = 0;
  let summedReach = 0;
  let clicks = 0;
  let spendMinor = 0;
  let conversions = 0;
  let conversionValueMinor = 0;
  let videoViews = 0;
  let watchPercentTotal = 0;
  let followersGained = 0;
  const distinctDates = new Set<string>();
  for (const { stat, weight } of weightedStats) {
    impressions += stat.impressions * weight;
    summedReach += stat.reach * weight;
    clicks += stat.clicks * weight;
    spendMinor += stat.spendMinor * weight;
    conversions += stat.conversions * weight;
    conversionValueMinor += stat.conversionValueMinor * weight;
    videoViews += stat.videoViews * weight;
    watchPercentTotal += stat.watchPercentTotal * weight;
    followersGained += stat.followersGained * weight;
    distinctDates.add(stat.date);
  }
  const attributionMultiplier = readAttributionMultiplier(attribution);
  conversions = Math.round(conversions * attributionMultiplier);
  conversionValueMinor = Math.round(conversionValueMinor * attributionMultiplier);
  const reach = Math.round(summedReach / (1 + Math.log(Math.max(distinctDates.size, 1)) * 0.38));
  const roundedImpressions = Math.round(impressions);
  const roundedClicks = Math.round(clicks);
  const roundedSpend = Math.round(spendMinor);
  return {
    impressions: roundedImpressions,
    reach,
    frequency: reach > 0 ? Number((roundedImpressions / reach).toFixed(2)) : 0,
    clicks: roundedClicks,
    ctr: roundedImpressions > 0 ? roundedClicks / roundedImpressions : 0,
    cpc: roundedClicks > 0 ? { amountMinor: Math.round(roundedSpend / roundedClicks), currency } : null,
    cpm: roundedImpressions > 0 ? { amountMinor: Math.round((roundedSpend / roundedImpressions) * 1000), currency } : null,
    spend: { amountMinor: roundedSpend, currency },
    conversions,
    conversionValue: { amountMinor: conversionValueMinor, currency },
    roas: roundedSpend > 0 && conversionValueMinor > 0 ? Number((conversionValueMinor / roundedSpend).toFixed(2)) : null,
    videoViews: Math.round(videoViews),
    averageWatchPercent: videoViews > 0 ? watchPercentTotal / videoViews / 100 : null,
    followersGained: Math.round(followersGained),
  };
}

export function readResultCountForObjective(objective: CampaignObjective, metrics: ReportMetrics, weightedStats: readonly WeightedStat[]): number {
  switch (objective) {
    case "awareness":
      return metrics.reach;
    case "engagement":
      return metrics.clicks + metrics.videoViews;
    case "messages":
      return Math.round(weightedStats.reduce((total, entry) => total + entry.stat.conversationsStarted * entry.weight, 0));
    case "followers":
      return metrics.followersGained;
    case "sales":
      return metrics.conversions;
    case "traffic":
    case "store_promotion":
      return metrics.clicks;
  }
}
