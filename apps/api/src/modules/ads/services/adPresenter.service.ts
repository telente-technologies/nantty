import type { CurrencyCode } from "../../../enums/currency.enum.js";
import { Money, type MoneyDto } from "../../../utils/money.util.js";
import type { AdCampaignRecord, AdRecord, AdSetRecord, CampaignObjective } from "../models/adCampaigns.model.js";
import { MILLI_MINOR_UNITS_PER_MINOR_UNIT, type AdEventRecord } from "../models/adDelivery.model.js";

export interface DeliverySummaryDto {
  readonly impressions: number;
  readonly reach: number;
  readonly clicks: number;
  readonly results: number;
  readonly spend: MoneyDto;
  readonly costPerResult: MoneyDto | null;
  readonly conversionValue: MoneyDto;
  readonly spentToday: MoneyDto;
}

export interface DeliveryWindow {
  readonly events: readonly AdEventRecord[];
  readonly todayStart: Date;
}

export function convertMilliMinorToMinor(milliMinor: number): number {
  return Math.floor(milliMinor / MILLI_MINOR_UNITS_PER_MINOR_UNIT);
}

function countResults(objective: CampaignObjective, impressions: number, reach: number, clicks: number, conversions: number): number {
  if (objective === "sales") return conversions;
  if (objective === "awareness") return reach;
  if (objective === "engagement" || objective === "followers") return clicks;
  return clicks;
}

export function summarizeDelivery(events: readonly AdEventRecord[], objective: CampaignObjective, currency: CurrencyCode, todayStart: Date): DeliverySummaryDto {
  const impressions = events.filter((event) => event.type === "impression" && event.rejectionReason === null);
  const clicks = events.filter((event) => event.type === "click" && event.rejectionReason === null).length;
  const conversions = events.filter((event) => event.type === "conversion");
  const reach = new Set(impressions.map((event) => event.viewerId)).size;
  const billedMilliMinor = events.reduce((total, event) => total + (event.billed ? event.chargeMilliMinor : 0), 0);
  const todayMilliMinor = events.reduce((total, event) => total + (event.billed && event.occurredAt >= todayStart ? event.chargeMilliMinor : 0), 0);
  const spendMinor = convertMilliMinorToMinor(billedMilliMinor);
  const results = countResults(objective, impressions.length, reach, clicks, conversions.length);
  return {
    impressions: impressions.length,
    reach,
    clicks,
    results,
    spend: Money.of(spendMinor, currency).toDto(),
    costPerResult: results === 0 ? null : Money.of(Math.round(spendMinor / results), currency).toDto(),
    conversionValue: Money.of(conversions.reduce((total, event) => total + (event.valueMinor ?? 0), 0), currency).toDto(),
    spentToday: Money.of(convertMilliMinorToMinor(todayMilliMinor), currency).toDto(),
  };
}

function presentBudget(type: string | null, amountMinor: number | null, currency: CurrencyCode) {
  return type === null || amountMinor === null ? null : { type, amount: Money.of(amountMinor, currency).toDto() };
}

export function presentCampaign(campaign: AdCampaignRecord, adSets: readonly AdSetRecord[], ads: readonly AdRecord[], window: DeliveryWindow) {
  const events = window.events.filter((event) => event.campaignId === campaign.id);
  return {
    id: campaign.id,
    accountId: campaign.accountId,
    name: campaign.name,
    objective: campaign.objective,
    status: campaign.status,
    budgetLevel: campaign.budgetLevel,
    budget: presentBudget(campaign.budgetType, campaign.budgetMinor, campaign.currency),
    spendCap: campaign.spendCapMinor === null ? null : Money.of(campaign.spendCapMinor, campaign.currency).toDto(),
    schedule: { startAt: campaign.startAt.toISOString(), endAt: campaign.endAt?.toISOString() ?? null },
    adSetCount: adSets.filter((adSet) => adSet.campaignId === campaign.id).length,
    adCount: ads.filter((ad) => ad.campaignId === campaign.id).length,
    rejectedAdCount: ads.filter((ad) => ad.campaignId === campaign.id && ad.reviewStatus === "rejected").length,
    delivery: summarizeDelivery(events, campaign.objective, campaign.currency, window.todayStart),
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
  };
}

export function presentAdSet(adSet: AdSetRecord, campaign: AdCampaignRecord, ads: readonly AdRecord[], window: DeliveryWindow) {
  const events = window.events.filter((event) => event.adSetId === adSet.id);
  return {
    id: adSet.id,
    accountId: adSet.accountId,
    campaignId: adSet.campaignId,
    name: adSet.name,
    status: adSet.status,
    audience: adSet.audience,
    placementMode: adSet.placementMode,
    placements: adSet.placements,
    schedule: { startAt: adSet.startAt.toISOString(), endAt: adSet.endAt?.toISOString() ?? null },
    budget: presentBudget(adSet.budgetType, adSet.budgetMinor, campaign.currency),
    bidStrategy: { type: adSet.bidType, amount: adSet.bidMinor === null ? null : Money.of(adSet.bidMinor, campaign.currency).toDto() },
    frequencyCap: adSet.frequencyImpressions === null || adSet.frequencyDays === null ? null : { impressions: adSet.frequencyImpressions, perDays: adSet.frequencyDays },
    conversionEventId: adSet.conversionEventId,
    experimentId: null,
    adCount: ads.filter((ad) => ad.adSetId === adSet.id).length,
    delivery: summarizeDelivery(events, campaign.objective, campaign.currency, window.todayStart),
    createdAt: adSet.createdAt.toISOString(),
    updatedAt: adSet.updatedAt.toISOString(),
  };
}

export function presentAd(ad: AdRecord, campaign: AdCampaignRecord, window: DeliveryWindow) {
  const events = window.events.filter((event) => event.adId === ad.id);
  const { topics: _topics, ...creative } = ad.creative;
  return {
    id: ad.id,
    accountId: ad.accountId,
    campaignId: ad.campaignId,
    adSetId: ad.adSetId,
    name: ad.name,
    status: ad.status,
    review: {
      status: ad.reviewStatus,
      policyCode: ad.policyCode,
      policyReason: ad.policyReason,
      reviewedAt: ad.reviewedAt?.toISOString() ?? null,
      appeal: ad.appeal,
    },
    creative,
    delivery: summarizeDelivery(events, campaign.objective, campaign.currency, window.todayStart),
    createdAt: ad.createdAt.toISOString(),
    updatedAt: ad.updatedAt.toISOString(),
  };
}

export type CampaignDto = ReturnType<typeof presentCampaign>;
export type AdSetDto = ReturnType<typeof presentAdSet>;
export type AdDto = ReturnType<typeof presentAd>;
