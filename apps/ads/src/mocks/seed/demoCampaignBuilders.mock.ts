import type { MockAdRecord, MockAdSetRecord, MockCampaignRecord } from "@/mocks/mockDatabase.mock";
import { demoIdentitiesByAccountId } from "@/mocks/seed/demoContent.mock";
import { demoLocations } from "@/mocks/seed/demoTargeting.mock";
import { shiftTimestampByDays } from "@/mocks/seed/seededRandom.mock";
import type { AudienceSpec } from "@/types/audience.type";
import type { AdPlacement, AdReview, BidStrategy, CampaignObjective, DeliveryStatus } from "@/types/campaign.type";
import type { CallToAction, ContentSource, CreativeFormat, CreativeMedia } from "@/types/creative.type";

export function findDemoLocations(...codes: string[]) {
  return codes.map((code) => {
    const location = demoLocations.find((candidate) => candidate.code === code);
    if (!location) throw new Error(`Unknown demo location ${code}`);
    return location;
  });
}

export function buildDemoAudience(overrides: Partial<AudienceSpec> & { locationCodes: string[] }): AudienceSpec {
  const { locationCodes, ...rest } = overrides;
  return {
    locations: findDemoLocations(...locationCodes),
    excludedLocations: [],
    ageMin: 18,
    ageMax: 65,
    gender: "all",
    topicIds: [],
    behaviourIds: [],
    customAudienceIds: [],
    excludedCustomAudienceIds: [],
    ...rest,
  };
}

export function buildMinorMoney(amountMajor: number, currency: string) {
  return { amountMinor: Math.round(amountMajor * 100), currency };
}

interface DemoCampaignSeed {
  readonly id: string;
  readonly accountId: string;
  readonly name: string;
  readonly objective: CampaignObjective;
  readonly status: DeliveryStatus;
  readonly currency: string;
  readonly dailyBudgetMajor: number | null;
  readonly lifetimeBudgetMajor?: number;
  readonly startDaysAgo: number;
  readonly endDaysFromNow: number | null;
}

export function buildDemoCampaign(seed: DemoCampaignSeed): MockCampaignRecord {
  const budget = seed.lifetimeBudgetMajor
    ? { type: "lifetime" as const, amount: buildMinorMoney(seed.lifetimeBudgetMajor, seed.currency) }
    : seed.dailyBudgetMajor
      ? { type: "daily" as const, amount: buildMinorMoney(seed.dailyBudgetMajor, seed.currency) }
      : null;
  return {
    id: seed.id,
    accountId: seed.accountId,
    name: seed.name,
    objective: seed.objective,
    status: seed.status,
    budgetLevel: budget ? "campaign" : "ad_set",
    budget,
    spendCap: null,
    schedule: { startAt: shiftTimestampByDays(-seed.startDaysAgo, 6), endAt: seed.endDaysFromNow === null ? null : shiftTimestampByDays(seed.endDaysFromNow, 22) },
    createdAt: shiftTimestampByDays(-seed.startDaysAgo - 1, 10),
    updatedAt: shiftTimestampByDays(-Math.min(seed.startDaysAgo, 2), 10),
  };
}

interface DemoAdSetSeed {
  readonly id: string;
  readonly campaign: MockCampaignRecord;
  readonly name: string;
  readonly audience: AudienceSpec;
  readonly placements: readonly AdPlacement[] | "automatic";
  readonly dailyBudgetMajor?: number;
  readonly bidStrategy?: BidStrategy;
  readonly status?: DeliveryStatus;
  readonly frequencyCap?: { impressions: number; perDays: number } | null;
}

const allPlacements: readonly AdPlacement[] = ["feed", "clips", "mart", "search", "stories", "live"];

export function buildDemoAdSet(seed: DemoAdSetSeed): MockAdSetRecord {
  const currency = seed.campaign.budget?.amount.currency ?? "NGN";
  return {
    id: seed.id,
    accountId: seed.campaign.accountId,
    campaignId: seed.campaign.id,
    name: seed.name,
    status: seed.status ?? seed.campaign.status,
    audience: seed.audience,
    placementMode: seed.placements === "automatic" ? "automatic" : "manual",
    placements: seed.placements === "automatic" ? allPlacements : seed.placements,
    schedule: seed.campaign.schedule,
    budget: seed.dailyBudgetMajor ? { type: "daily", amount: buildMinorMoney(seed.dailyBudgetMajor, currency) } : null,
    bidStrategy: seed.bidStrategy ?? { type: "auto", amount: null },
    frequencyCap: seed.frequencyCap ?? null,
    conversionEventId: seed.campaign.objective === "sales" ? `cev_${seed.campaign.accountId}_purchase` : null,
    experimentId: null,
    createdAt: seed.campaign.createdAt,
    updatedAt: seed.campaign.updatedAt,
  };
}

const approvedReview: AdReview = { status: "approved", policyCode: null, policyReason: null, reviewedAt: shiftTimestampByDays(-20, 14), appeal: null };

interface DemoAdSeed {
  readonly id: string;
  readonly adSet: MockAdSetRecord;
  readonly name: string;
  readonly source: ContentSource;
  readonly format: CreativeFormat;
  readonly headline: string;
  readonly primaryText?: string;
  readonly callToAction: CallToAction;
  readonly status?: DeliveryStatus;
  readonly review?: AdReview;
  readonly media?: readonly CreativeMedia[];
}

export function buildDemoAd(seed: DemoAdSeed): MockAdRecord {
  const identity = demoIdentitiesByAccountId[seed.adSet.accountId] ?? { name: "Advertiser", handle: "advertiser", avatarUrl: null, verifiedBusiness: false };
  const destinationType = seed.source.type === "product" ? "product" : seed.source.type === "store" ? "store" : seed.callToAction === "send_message" ? "messages" : "post";
  const status = seed.status ?? seed.adSet.status;
  return {
    id: seed.id,
    accountId: seed.adSet.accountId,
    campaignId: seed.adSet.campaignId,
    adSetId: seed.adSet.id,
    name: seed.name,
    status,
    review: seed.review ?? (status === "draft" ? { status: "not_submitted", policyCode: null, policyReason: null, reviewedAt: null, appeal: null } : approvedReview),
    creative: {
      type: "single",
      mediaClickable: false,
      format: seed.format,
      source: { type: seed.source.type, id: seed.source.id },
      media: seed.media ?? seed.source.media,
      headline: seed.headline,
      primaryText: seed.primaryText ?? seed.source.text,
      callToAction: seed.callToAction,
      destination: { type: destinationType, targetId: seed.source.id, url: null },
      identity,
      product: seed.source.product,
    },
    submittedAt: status === "in_review" ? new Date(Date.now() - 5_000).toISOString() : null,
    createdAt: seed.adSet.createdAt,
    updatedAt: seed.adSet.updatedAt,
  };
}
