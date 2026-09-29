import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { clickRateByObjective, costPerThousandMajorByCurrency } from "@/mocks/seed/demoStats.mock";
import { estimatePopulationForLocation } from "@/mocks/seed/demoTargeting.mock";
import { findObjectiveOption } from "@/constants/campaignOptions.constant";
import type { AudienceBreadth, AudienceEstimate, AudienceEstimateRequest, LocationTarget } from "@/types/audience.type";
import type { NumberRange } from "@/types/money.type";

const ageShareByBucket: readonly [number, number, number][] = [
  [18, 24, 0.29],
  [25, 34, 0.33],
  [35, 44, 0.2],
  [45, 54, 0.11],
  [55, 65, 0.07],
];

function calculateAgeShare(ageMin: number, ageMax: number): number {
  return ageShareByBucket.reduce((share, [bucketMin, bucketMax, bucketShare]) => {
    const overlap = Math.max(0, Math.min(ageMax, bucketMax) - Math.max(ageMin, bucketMin) + 1);
    return share + bucketShare * (overlap / (bucketMax - bucketMin + 1));
  }, 0);
}

function isCoveredByBroaderLocation(location: LocationTarget, locations: readonly LocationTarget[]): boolean {
  if (location.type === "country") return false;
  if (locations.some((candidate) => candidate.type === "country" && candidate.code === location.countryCode)) return true;
  return location.type === "city" && locations.some((candidate) => candidate.type === "state" && location.code.startsWith(`${candidate.code}-`));
}

function sumPopulation(locations: readonly LocationTarget[]): number {
  return locations.filter((location) => !isCoveredByBroaderLocation(location, locations)).reduce((total, location) => total + estimatePopulationForLocation(location), 0);
}

function roundToFriendlyNumber(value: number): number {
  if (value < 1000) return Math.round(value / 10) * 10;
  const magnitude = 10 ** (Math.floor(Math.log10(value)) - 1);
  return Math.round(value / magnitude) * magnitude;
}

function buildRange(center: number, spread: number): NumberRange {
  return { lower: roundToFriendlyNumber(center * (1 - spread)), upper: roundToFriendlyNumber(center * (1 + spread)) };
}

export function estimateAudienceForRequest(accountId: string, currency: string, request: AudienceEstimateRequest): AudienceEstimate {
  const { audience } = request;
  const warnings: string[] = [];
  let size = Math.max(0, sumPopulation(audience.locations) - sumPopulation(audience.excludedLocations) * 0.9);
  size *= calculateAgeShare(audience.ageMin, audience.ageMax);
  if (audience.gender !== "all") size *= audience.gender === "female" ? 0.51 : 0.49;
  if (audience.topicIds.length > 0) size *= Math.min(0.85, 0.14 + 0.06 * audience.topicIds.length);
  if (audience.behaviourIds.length > 0) size *= Math.min(0.7, 0.09 + 0.05 * audience.behaviourIds.length);
  const accountAudiences = readMockDatabase().audiences.filter((candidate) => candidate.accountId === accountId);
  const includedCustom = accountAudiences.filter((candidate) => audience.customAudienceIds.includes(candidate.id));
  if (includedCustom.length > 0) size = Math.min(size, includedCustom.reduce((total, candidate) => total + (candidate.approximateSize?.upper ?? 0) * 0.85, 0));
  const excludedCustom = accountAudiences.filter((candidate) => audience.excludedCustomAudienceIds.includes(candidate.id));
  size = Math.max(0, size - excludedCustom.reduce((total, candidate) => total + (candidate.approximateSize?.lower ?? 0) * 0.7, 0));
  if (includedCustom.some((candidate) => candidate.status !== "ready")) warnings.push("One of your custom audiences is still building or too small, so delivery may be limited.");
  const placementShare = 0.5 + 0.5 * (request.placements.length / 6);
  size *= placementShare;

  const breadth: AudienceBreadth = size < 1000 ? "too_narrow" : size < 60_000 ? "narrow" : size < 6_000_000 ? "balanced" : "broad";
  if (breadth === "too_narrow") warnings.push("This audience is too small to deliver. Add locations, widen the age range or remove some interests.");
  if (breadth === "broad" && request.objective === "sales") warnings.push("Very broad audiences can work for sales, but add interests or a lookalike if results are slow.");

  const [cpmLow, cpmHigh] = costPerThousandMajorByCurrency[currency] ?? [2, 6];
  const averageCpmMinor = ((cpmLow + cpmHigh) / 2) * 100;
  const budget = request.budget;
  let dailyBudgetMinor: number | null = null;
  if (budget?.type === "daily") dailyBudgetMinor = budget.amount.amountMinor;
  if (budget?.type === "lifetime" && request.schedule.endAt) {
    const days = Math.max(1, Math.ceil((Date.parse(request.schedule.endAt) - Date.parse(request.schedule.startAt)) / 86_400_000));
    dailyBudgetMinor = Math.round(budget.amount.amountMinor / days);
  }
  if (request.bidStrategy.type === "max_cpm" && request.bidStrategy.amount && request.bidStrategy.amount.amountMinor < cpmLow * 100) {
    warnings.push("Your maximum CPM is below what similar advertisers pay, so you may not spend your full budget.");
  }
  if (request.bidStrategy.type === "max_cpc" && request.bidStrategy.amount && request.bidStrategy.amount.amountMinor < (cpmLow * 100) / (1000 * clickRateByObjective[request.objective])) {
    warnings.push("Your maximum cost per click is low for this audience. Delivery may be slow.");
  }

  const option = findObjectiveOption(request.objective);
  if (!dailyBudgetMinor || size < 1000) {
    return { audienceSize: buildRange(size, 0.15), breadth, dailyReach: null, dailyResults: null, resultLabel: option.resultLabel, warnings };
  }
  const dailyImpressions = (dailyBudgetMinor / averageCpmMinor) * 1000;
  const dailyReachCenter = Math.min(dailyImpressions / 1.4, size * 0.35);
  const resultsCenter = request.objective === "awareness" ? dailyReachCenter : dailyImpressions * clickRateByObjective[request.objective] * (request.objective === "sales" ? 0.04 : request.objective === "messages" ? 0.22 : request.objective === "followers" ? 0.3 : 1);
  return { audienceSize: buildRange(size, 0.15), breadth, dailyReach: buildRange(dailyReachCenter, 0.3), dailyResults: buildRange(Math.max(resultsCenter, 1), 0.4), resultLabel: option.resultLabel, warnings };
}
