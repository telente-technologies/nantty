import { failValidation, readJsonObjectBody, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import type { CampaignCostEstimate, EstimateRange, RegionCostEstimate, RegionalAdPricingRow } from "@/types/billing.type";

const regionRows: readonly RegionalAdPricingRow[] = [
  { region: "NG", currency: "NGN", cpmFloorMinor: 40_000, cpcFloorMinor: 2_500, minimumDailyBudgetMinor: 100_000, boostMinimumDailyMinor: 100_000, suggestedCpmMinor: 150_000, suggestedCpcMinor: 6_000, suggestedCpvMinor: 500, suggestedDailyBudgetMinor: 500_000 },
  { region: "GH", currency: "GHS", cpmFloorMinor: 600, cpcFloorMinor: 40, minimumDailyBudgetMinor: 1_500, boostMinimumDailyMinor: 1_500, suggestedCpmMinor: 1_800, suggestedCpcMinor: 100, suggestedCpvMinor: 6, suggestedDailyBudgetMinor: 7_500 },
  { region: "KE", currency: "KES", cpmFloorMinor: 8_000, cpcFloorMinor: 500, minimumDailyBudgetMinor: 15_000, boostMinimumDailyMinor: 15_000, suggestedCpmMinor: 17_000, suggestedCpcMinor: 1_200, suggestedCpvMinor: 60, suggestedDailyBudgetMinor: 75_000 },
  { region: "ZA", currency: "ZAR", cpmFloorMinor: 2_800, cpcFloorMinor: 150, minimumDailyBudgetMinor: 4_000, boostMinimumDailyMinor: 4_000, suggestedCpmMinor: 5_000, suggestedCpcMinor: 400, suggestedCpvMinor: 20, suggestedDailyBudgetMinor: 20_000 },
  { region: "GB", currency: "GBP", cpmFloorMinor: 250, cpcFloorMinor: 30, minimumDailyBudgetMinor: 500, boostMinimumDailyMinor: 500, suggestedCpmMinor: 600, suggestedCpcMinor: 55, suggestedCpvMinor: 2, suggestedDailyBudgetMinor: 2_500 },
  { region: "EU", currency: "EUR", cpmFloorMinor: 300, cpcFloorMinor: 30, minimumDailyBudgetMinor: 500, boostMinimumDailyMinor: 500, suggestedCpmMinor: 650, suggestedCpcMinor: 60, suggestedCpvMinor: 2, suggestedDailyBudgetMinor: 2_500 },
  { region: "US", currency: "USD", cpmFloorMinor: 350, cpcFloorMinor: 35, minimumDailyBudgetMinor: 500, boostMinimumDailyMinor: 500, suggestedCpmMinor: 800, suggestedCpcMinor: 65, suggestedCpvMinor: 3, suggestedDailyBudgetMinor: 2_500 },
];
const unitsPerDollar: Record<string, number> = { USD: 1, NGN: 1550, GHS: 15.5, KES: 129, ZAR: 18.2, GBP: 0.79, EUR: 0.92 };
const regionWeights: Record<string, number> = { NG: 9_000_000, GH: 1_500_000, KE: 2_000_000, ZA: 2_500_000, GB: 1_000_000, EU: 1_000_000, US: 1_000_000 };
const eurozone = new Set(["AT", "BE", "HR", "CY", "EE", "FI", "FR", "DE", "GR", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PT", "SK", "SI", "ES"]);
const resultKinds: Record<string, CampaignCostEstimate["resultKind"]> = { awareness: "reach", engagement: "video_views", traffic: "clicks", store_promotion: "clicks", sales: "clicks", followers: "follows", messages: "messages" };

const convertUp = (amountMinor: number, from: string, to: string) => Math.ceil((amountMinor * (unitsPerDollar[to] ?? 1)) / (unitsPerDollar[from] ?? 1));
const regionsFor = (countries: readonly string[]) => [...new Set(countries.map((code) => (eurozone.has(code) ? "EU" : regionRows.some((row) => row.region === code) ? code : "US")))].sort();
const findRow = (region: string) => regionRows.find((row) => row.region === region) ?? regionRows[regionRows.length - 1]!;
const scale = (range: EstimateRange, factor: number): EstimateRange => ({ low: Math.floor(range.low * factor), high: Math.floor(range.high * factor) });
const add = (first: EstimateRange, second: EstimateRange): EstimateRange => ({ low: first.low + second.low, high: first.high + second.high });
const costPer = (total: number, results: EstimateRange): EstimateRange => (results.high > 0 ? { low: Math.floor(total / results.high), high: results.low > 0 ? Math.ceil(total / results.low) : total } : { low: 0, high: 0 });

function readCountries(value: unknown): string[] {
  return Array.isArray(value) ? value.map((code) => String(code).trim().toUpperCase()).filter((code) => /^[A-Z]{2}$/.test(code)) : [];
}

function estimateRegion(region: string, dailyMinor: number, days: number, kind: CampaignCostEstimate["resultKind"], currency: string, shareBps: number): RegionCostEstimate {
  const row = findRow(region);
  const suggestedCpm = convertUp(row.suggestedCpmMinor, row.currency, currency);
  const total = dailyMinor * days;
  const impressions = { low: Math.floor((total * 1000) / (suggestedCpm * 1.3)), high: Math.floor((total * 1000) / (suggestedCpm * 0.75)) };
  const reach = { low: Math.floor(impressions.low / 1.8), high: Math.floor(impressions.high / 1.4) };
  const clicks = { low: Math.floor(impressions.low * 0.006), high: Math.floor(impressions.high * 0.014) };
  const videoViews = { low: Math.floor(impressions.low * 0.2), high: Math.floor(impressions.high * 0.35) };
  const results = kind === "reach" ? reach : kind === "video_views" ? videoViews : kind === "follows" ? scale(clicks, 0.05) : kind === "messages" ? scale(clicks, 0.1) : clicks;
  const minimum = convertUp(row.minimumDailyBudgetMinor, row.currency, currency);
  const rate = (unitsPerDollar[currency] ?? 1) / (unitsPerDollar[row.currency] ?? 1);
  return {
    region, localCurrency: row.currency, budgetShareBps: shareBps, dailyBudgetMinor: dailyMinor, totalBudgetMinor: total, minimumDailyBudgetMinor: minimum,
    suggestedDailyBudgetMinor: convertUp(row.suggestedDailyBudgetMinor, row.currency, currency), suggestedCpmMinor: suggestedCpm, suggestedCpcMinor: convertUp(row.suggestedCpcMinor, row.currency, currency),
    impressions, reach, clicks, videoViews, results, costPerResultMinor: costPer(total, results), belowRegionMinimum: dailyMinor < minimum,
    ...(row.currency === currency ? {} : { exchangeNote: rate >= 1 ? `1 ${row.currency} ≈ ${rate.toFixed(2)} ${currency} (currency module rate)` : `1 ${currency} ≈ ${(1 / rate).toFixed(2)} ${row.currency} (currency module rate)` }),
  };
}

function presentRegionalPricing(countries: readonly string[], currency: string) {
  const regions = regionsFor(countries);
  const targeted = regions.length > 0 ? regions.map(findRow) : regionRows.filter((row) => row.currency === currency);
  const strictest = (pick: (row: RegionalAdPricingRow) => number) => ({ amountMinor: Math.max(...targeted.map((row) => convertUp(pick(row), row.currency, currency))), currency });
  const boostMinimum = strictest((row) => row.boostMinimumDailyMinor).amountMinor;
  return {
    billingCurrency: currency, targetedRegions: regions, creatorRevenueSharePercent: 40, regions: regionRows,
    cpmFloor: strictest((row) => row.cpmFloorMinor), cpcFloor: strictest((row) => row.cpcFloorMinor), suggestedCpm: strictest((row) => row.suggestedCpmMinor),
    suggestedCpc: strictest((row) => row.suggestedCpcMinor), suggestedCpv: strictest((row) => row.suggestedCpvMinor), minimumDailyBudget: strictest((row) => row.minimumDailyBudgetMinor),
    suggestedDailyBudget: strictest((row) => row.suggestedDailyBudgetMinor), boostMinimumDailyBudget: { amountMinor: boostMinimum, currency },
    boostPackages: [[1, 1, "1 day"], [3, 3, "3 days"], [7, 7, "1 week"], [15, 7, "1 week, wider reach"]].map(([multiple, days, label]) => ({ priceMinor: boostMinimum * Number(multiple), currency, days, label })),
  };
}

export function registerRegionalPricingMockHandlers(): void {
  registerMockRoute("GET", "/ads/pricing", (request) => {
    const currency = (request.query.get("currency") ?? "USD").toUpperCase();
    return respondWithJson(200, presentRegionalPricing(readCountries((request.query.get("countries") ?? "").split(",")), unitsPerDollar[currency] ? currency : "USD"));
  });

  registerMockRoute("POST", "/ads/pricing/estimate", (request) => {
    const body = readJsonObjectBody(request);
    const currency = String(body.currency ?? "").toUpperCase();
    const budget = (body.budget ?? {}) as { type?: string; amountMinor?: number };
    if (!unitsPerDollar[currency] || (budget.type !== "daily" && budget.type !== "lifetime") || typeof budget.amountMinor !== "number" || budget.amountMinor < 0) failValidation("budget", "Give a daily or lifetime budget in a supported currency.");
    const start = Date.parse(String(body.startAt ?? ""));
    const end = Date.parse(String(body.endAt ?? ""));
    const days = Math.min(366, Math.max(1, !Number.isNaN(start) && !Number.isNaN(end) && end > start ? Math.ceil((end - start) / 86_400_000) : Number(body.days) || 7));
    const regions = regionsFor(readCountries(body.countries));
    const targeted = regions.length > 0 ? regions : [regionRows.find((row) => row.currency === currency)?.region ?? "US"];
    const kind = resultKinds[String(body.objective)] ?? "clicks";
    const daily = budget.type === "lifetime" ? Math.floor(budget.amountMinor! / days) : budget.amountMinor!;
    const totalWeight = targeted.reduce((sum, region) => sum + (regionWeights[region] ?? 1), 0);
    let allocated = 0;
    const regionEstimates = targeted.map((region, index) => {
      const share = index === targeted.length - 1 ? daily - allocated : Math.floor((daily * (regionWeights[region] ?? 1)) / totalWeight);
      allocated += share;
      return estimateRegion(region, share, days, kind, currency, Math.floor(((regionWeights[region] ?? 1) * 10_000) / totalWeight));
    });
    const zero = { low: 0, high: 0 };
    const sum = (pick: (estimate: RegionCostEstimate) => EstimateRange) => regionEstimates.reduce((total, estimate) => add(total, pick(estimate)), zero);
    const minimum = Math.max(...regionEstimates.map((estimate) => estimate.minimumDailyBudgetMinor));
    const suggestedDaily = Math.max(minimum, regionEstimates.reduce((total, estimate) => total + estimate.suggestedDailyBudgetMinor, 0));
    const results = sum((estimate) => estimate.results);
    const estimate: CampaignCostEstimate = {
      billingCurrency: currency, days, dailyBudgetMinor: daily, totalCostMinor: daily * days, minimumDailyBudgetMinor: minimum, suggestedDailyBudgetMinor: suggestedDaily,
      suggestedLifetimeBudgetMinor: suggestedDaily * days, resultKind: kind, impressions: sum((item) => item.impressions), reach: sum((item) => item.reach), clicks: sum((item) => item.clicks),
      videoViews: sum((item) => item.videoViews), results, costPerResultMinor: costPer(daily * days, results), belowMinimum: daily < minimum, regions: regionEstimates,
    };
    return respondWithJson(200, estimate);
  });
}
