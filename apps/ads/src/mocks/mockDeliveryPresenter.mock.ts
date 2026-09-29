import { readMockDatabase, type MockAdRecord, type MockAdSetRecord, type MockCampaignRecord } from "@/mocks/mockDatabase.mock";
import { aggregateWeightedStatsIntoMetrics, collectWeightedStats, readResultCountForObjective, type StatFilter } from "@/mocks/mockStatAggregation.mock";
import type { Ad, AdSet, Campaign, DeliverySummary } from "@/types/campaign.type";

function readAccountCurrency(accountId: string): string {
  return readMockDatabase().accounts.find((account) => account.id === accountId)?.currency ?? "USD";
}

function estimateSpendSoFarToday(dailyBudgetMinor: number | null, isActive: boolean): number {
  if (!isActive || !dailyBudgetMinor) return 0;
  const now = new Date();
  const fractionOfDayElapsed = (now.getUTCHours() + 1 + now.getUTCMinutes() / 60) / 24;
  return Math.round(dailyBudgetMinor * Math.min(fractionOfDayElapsed, 1) * 0.93);
}

function buildDeliverySummary(filter: StatFilter, campaign: MockCampaignRecord, dailyBudgetMinor: number | null, isActive: boolean): DeliverySummary {
  const currency = readAccountCurrency(filter.accountId);
  const weightedStats = collectWeightedStats(filter);
  const metrics = aggregateWeightedStatsIntoMetrics(weightedStats, currency);
  const results = readResultCountForObjective(campaign.objective, metrics, weightedStats);
  return {
    impressions: metrics.impressions,
    reach: metrics.reach,
    clicks: metrics.clicks,
    results,
    spend: metrics.spend,
    costPerResult: results > 0 ? { amountMinor: Math.round(metrics.spend.amountMinor / results), currency } : null,
    conversionValue: metrics.conversionValue,
    spentToday: { amountMinor: estimateSpendSoFarToday(dailyBudgetMinor, isActive), currency },
  };
}

export interface DeliveryRange {
  readonly from: string | null;
  readonly to: string | null;
}

export function presentCampaign(campaign: MockCampaignRecord, range: DeliveryRange = { from: null, to: null }): Campaign {
  const database = readMockDatabase();
  const campaignAdSets = database.adSets.filter((adSet) => adSet.campaignId === campaign.id);
  const campaignAds = database.ads.filter((ad) => ad.campaignId === campaign.id);
  const dailyBudgetMinor = campaign.budget?.type === "daily" ? campaign.budget.amount.amountMinor : campaignAdSets.reduce((total, adSet) => total + (adSet.budget?.type === "daily" ? adSet.budget.amount.amountMinor : 0), 0) || null;
  return {
    ...campaign,
    adSetCount: campaignAdSets.length,
    adCount: campaignAds.length,
    rejectedAdCount: campaignAds.filter((ad) => ad.review.status === "rejected").length,
    delivery: buildDeliverySummary({ accountId: campaign.accountId, ...range, campaignIds: [campaign.id] }, campaign, dailyBudgetMinor, campaign.status === "active"),
  };
}

export function presentAdSet(adSet: MockAdSetRecord, range: DeliveryRange = { from: null, to: null }): AdSet {
  const database = readMockDatabase();
  const campaign = database.campaigns.find((candidate) => candidate.id === adSet.campaignId);
  if (!campaign) throw new Error("Ad set without campaign");
  const adSetCount = database.adSets.filter((candidate) => candidate.campaignId === campaign.id).length || 1;
  const dailyBudgetMinor = adSet.budget?.type === "daily" ? adSet.budget.amount.amountMinor : campaign.budget?.type === "daily" ? Math.round(campaign.budget.amount.amountMinor / adSetCount) : null;
  return {
    ...adSet,
    adCount: database.ads.filter((ad) => ad.adSetId === adSet.id).length,
    delivery: buildDeliverySummary({ accountId: adSet.accountId, ...range, adSetIds: [adSet.id] }, campaign, dailyBudgetMinor, adSet.status === "active"),
  };
}

export function presentAd(ad: MockAdRecord, range: DeliveryRange = { from: null, to: null }): Ad {
  const database = readMockDatabase();
  const campaign = database.campaigns.find((candidate) => candidate.id === ad.campaignId);
  if (!campaign) throw new Error("Ad without campaign");
  const { submittedAt: _submittedAt, ...adWithoutInternalFields } = ad;
  return { ...adWithoutInternalFields, delivery: buildDeliverySummary({ accountId: ad.accountId, ...range, adIds: [ad.id] }, campaign, null, ad.status === "active") };
}
