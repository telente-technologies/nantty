import { throwIfValidationIssues } from "../../../errors/ads.error.js";
import { CLICK_RATE_BY_OBJECTIVE, COST_PER_THOUSAND_MAJOR_RANGE_BY_CURRENCY, REACHABLE_PEOPLE_BY_LOCATION_CODE, RESULT_LABEL_BY_OBJECTIVE } from "../constants/adTargeting.constant.js";
import type { AdPlacement, AudienceSpec, BidStrategyType, CampaignObjective, LocationTarget } from "../models/adCampaigns.model.js";
import type { AdsToolsRepositories } from "../models/adsToolsDependencies.model.js";
import type { AdAccountAccess } from "./adAccountAccess.service.js";
import { buildRoundedRange } from "./adAudiences.service.js";

const AGE_SHARE_BY_BUCKET: readonly [number, number, number][] = [[18, 24, 0.29], [25, 34, 0.33], [35, 44, 0.2], [45, 54, 0.11], [55, 65, 0.07]];
const TOTAL_PLACEMENT_COUNT = 6;

export interface AudienceEstimateInput {
  readonly objective: CampaignObjective;
  readonly audience: AudienceSpec;
  readonly placements: readonly AdPlacement[];
  readonly budget: { readonly type: "daily" | "lifetime"; readonly amount: { readonly amountMinor: number; readonly currency: string } } | null;
  readonly bidStrategy: { readonly type: BidStrategyType; readonly amount: { readonly amountMinor: number; readonly currency: string } | null };
  readonly schedule: { readonly startAt: string; readonly endAt: string | null };
}

function calculateAgeShare(ageMin: number, ageMax: number): number {
  return AGE_SHARE_BY_BUCKET.reduce((share, [bucketMin, bucketMax, bucketShare]) => {
    const overlap = Math.max(0, Math.min(ageMax, bucketMax) - Math.max(ageMin, bucketMin) + 1);
    return share + bucketShare * (overlap / (bucketMax - bucketMin + 1));
  }, 0);
}

function isCoveredByBroaderLocation(location: LocationTarget, locations: readonly LocationTarget[]): boolean {
  if (location.type === "country") return false;
  if (locations.some((candidate) => candidate.type === "country" && candidate.code === location.countryCode)) return true;
  return location.type === "city" && locations.some((candidate) => candidate.type === "state" && location.code.startsWith(`${candidate.code}-`));
}

function sumReachablePeople(locations: readonly LocationTarget[]): number {
  return locations
    .filter((location) => !isCoveredByBroaderLocation(location, locations))
    .reduce((total, location) => total + (REACHABLE_PEOPLE_BY_LOCATION_CODE[location.code] ?? (location.type === "city" ? 650_000 : 800_000)), 0);
}

export class AdAudienceEstimatesService {
  public constructor(private readonly repositories: AdsToolsRepositories, private readonly access: AdAccountAccess) {}

  public async estimateAudience(userId: string, accountId: string, input: AudienceEstimateInput) {
    const { account } = await this.access.requirePermission(userId, accountId, "campaigns:view");
    if (input.budget !== null && input.budget.amount.currency !== account.currency) throwIfValidationIssues([{ path: "budget.amount", message: `Amounts must be in ${account.currency}.` }]);
    const { audience } = input;
    const warnings: string[] = [];
    let size = Math.max(0, sumReachablePeople(audience.locations) - sumReachablePeople(audience.excludedLocations) * 0.9);
    size *= calculateAgeShare(audience.ageMin, audience.ageMax);
    if (audience.gender !== "all") size *= audience.gender === "female" ? 0.51 : 0.49;
    if (audience.topicIds.length > 0) size *= Math.min(0.85, 0.14 + 0.06 * audience.topicIds.length);
    if (audience.behaviourIds.length > 0) size *= Math.min(0.7, 0.09 + 0.05 * audience.behaviourIds.length);
    const accountAudiences = await this.repositories.audiences.listAudiences(accountId);
    const included = accountAudiences.filter((candidate) => audience.customAudienceIds.includes(candidate.id));
    if (included.length > 0) size = Math.min(size, included.reduce((total, candidate) => total + (candidate.sizeUpper ?? 0) * 0.85, 0));
    const excluded = accountAudiences.filter((candidate) => audience.excludedCustomAudienceIds.includes(candidate.id));
    size = Math.max(0, size - excluded.reduce((total, candidate) => total + (candidate.sizeLower ?? 0) * 0.7, 0));
    if (included.some((candidate) => candidate.status !== "ready")) warnings.push("One of your custom audiences is still building or too small, so delivery may be limited.");
    size *= 0.5 + 0.5 * (Math.max(1, input.placements.length) / TOTAL_PLACEMENT_COUNT);
    const breadth = size < 1000 ? "too_narrow" : size < 60_000 ? "narrow" : size < 6_000_000 ? "balanced" : "broad";
    if (breadth === "too_narrow") warnings.push("This audience is too small to deliver. Add locations, widen the age range or remove some interests.");
    if (breadth === "broad" && input.objective === "sales") warnings.push("Very broad audiences can work for sales, but add interests or a lookalike if results are slow.");
    const [cpmLow, cpmHigh] = COST_PER_THOUSAND_MAJOR_RANGE_BY_CURRENCY[account.currency] ?? [2, 6];
    const averageCpmMinor = ((cpmLow + cpmHigh) / 2) * 100;
    const dailyBudgetMinor = this.readDailyBudgetMinor(input);
    const bidAmount = input.bidStrategy.amount?.amountMinor;
    if (input.bidStrategy.type === "max_cpm" && bidAmount !== undefined && bidAmount < cpmLow * 100) warnings.push("Your maximum CPM is below what similar advertisers pay, so you may not spend your full budget.");
    if (input.bidStrategy.type === "max_cpc" && bidAmount !== undefined && bidAmount < (cpmLow * 100) / (1000 * CLICK_RATE_BY_OBJECTIVE[input.objective])) warnings.push("Your maximum cost per click is low for this audience. Delivery may be slow.");
    const resultLabel = RESULT_LABEL_BY_OBJECTIVE[input.objective];
    if (dailyBudgetMinor === null || size < 1000) return { audienceSize: buildRoundedRange(size, 0.15), breadth, dailyReach: null, dailyResults: null, resultLabel, warnings };
    const dailyImpressions = (dailyBudgetMinor / averageCpmMinor) * 1000;
    const dailyReachCenter = Math.min(dailyImpressions / 1.4, size * 0.35);
    const conversionShare = input.objective === "sales" ? 0.04 : input.objective === "messages" ? 0.22 : input.objective === "followers" ? 0.3 : 1;
    const resultsCenter = input.objective === "awareness" ? dailyReachCenter : dailyImpressions * CLICK_RATE_BY_OBJECTIVE[input.objective] * conversionShare;
    return { audienceSize: buildRoundedRange(size, 0.15), breadth, dailyReach: buildRoundedRange(dailyReachCenter, 0.3), dailyResults: buildRoundedRange(Math.max(resultsCenter, 1), 0.4), resultLabel, warnings };
  }

  private readDailyBudgetMinor(input: AudienceEstimateInput): number | null {
    if (input.budget === null) return null;
    if (input.budget.type === "daily") return input.budget.amount.amountMinor;
    if (input.schedule.endAt === null) return null;
    const days = Math.max(1, Math.ceil((Date.parse(input.schedule.endAt) - Date.parse(input.schedule.startAt)) / 86_400_000));
    return Math.round(input.budget.amount.amountMinor / days);
  }
}
