import { placementLabels } from "@/constants/campaignOptions.constant";
import { aggregateWeightedStatsIntoMetrics, collectWeightedStats, type AttributionSettings, type WeightedStat } from "@/mocks/mockStatAggregation.mock";
import { demoLocations, estimatePopulationForLocation } from "@/mocks/seed/demoTargeting.mock";
import type { AdPlacement } from "@/types/campaign.type";
import type { ReportBreakdown, ReportQuery, ReportResponse, ReportRow, ReportSeriesPoint } from "@/types/report.type";

interface Slice {
  readonly key: string;
  readonly label: string;
  readonly share: number;
}

const placementAffinity: Record<AdPlacement, number> = { feed: 1, clips: 1.25, mart: 0.8, search: 0.35, stories: 0.6, live: 0.25 };
const ageBuckets: readonly [string, number, number, number][] = [["18-24", 18, 24, 0.29], ["25-34", 25, 34, 0.33], ["35-44", 35, 44, 0.2], ["45-54", 45, 54, 0.11], ["55-65+", 55, 65, 0.07]];

function normalizeSlices(slices: Slice[]): Slice[] {
  const total = slices.reduce((sum, slice) => sum + slice.share, 0) || 1;
  return slices.map((slice) => ({ ...slice, share: slice.share / total }));
}

function splitIntoPlacements(entry: WeightedStat): Slice[] {
  return normalizeSlices(entry.adSet.placements.map((placement) => ({ key: placement, label: placementLabels[placement], share: placementAffinity[placement] })));
}

function listStatesForLocation(code: string, type: string, countryCode: string): { code: string; name: string; countryCode: string }[] {
  if (type === "state") return demoLocations.filter((location) => location.code === code);
  if (type === "city") return demoLocations.filter((location) => location.type === "state" && code.startsWith(`${location.code}-`));
  return demoLocations.filter((location) => location.type === "state" && location.countryCode === countryCode);
}

function splitIntoStates(entry: WeightedStat): Slice[] {
  const states = entry.adSet.audience.locations.flatMap((location) => listStatesForLocation(location.code, location.type, location.countryCode));
  const unique = [...new Map(states.map((state) => [state.code, state])).values()];
  if (unique.length === 0) return [{ key: "unknown", label: "Other regions", share: 1 }];
  return normalizeSlices(unique.map((state) => ({ key: state.code, label: state.name, share: estimatePopulationForLocation({ type: "state", code: state.code, name: state.name, countryCode: state.countryCode, parentName: null }) })));
}

function splitIntoCountries(entry: WeightedStat): Slice[] {
  const countryCodes = [...new Set(entry.adSet.audience.locations.map((location) => location.countryCode))];
  return normalizeSlices(countryCodes.map((countryCode) => ({ key: countryCode, label: demoLocations.find((location) => location.code === countryCode)?.name ?? countryCode, share: countryCode === "NG" ? 3 : 1 })));
}

function splitIntoAgeBuckets(entry: WeightedStat): Slice[] {
  const { ageMin, ageMax } = entry.adSet.audience;
  return normalizeSlices(
    ageBuckets
      .map(([label, bucketMin, bucketMax, share]) => ({ key: label, label, share: share * (Math.max(0, Math.min(ageMax, bucketMax) - Math.max(ageMin, bucketMin) + 1) / (bucketMax - bucketMin + 1)) }))
      .filter((slice) => slice.share > 0),
  );
}

function splitIntoGenders(entry: WeightedStat): Slice[] {
  const gender = entry.adSet.audience.gender;
  if (gender === "female") return [{ key: "female", label: "Women", share: 0.97 }, { key: "unknown", label: "Not specified", share: 0.03 }];
  if (gender === "male") return [{ key: "male", label: "Men", share: 0.97 }, { key: "unknown", label: "Not specified", share: 0.03 }];
  return [{ key: "female", label: "Women", share: 0.54 }, { key: "male", label: "Men", share: 0.42 }, { key: "unknown", label: "Not specified", share: 0.04 }];
}

function readSlicesForBreakdown(entry: WeightedStat, breakdown: ReportBreakdown): Slice[] {
  switch (breakdown) {
    case "campaign":
      return [{ key: entry.campaign.id, label: entry.campaign.name, share: 1 }];
    case "ad_set":
      return [{ key: entry.adSet.id, label: entry.adSet.name, share: 1 }];
    case "ad":
      return [{ key: entry.ad.id, label: entry.ad.name, share: 1 }];
    case "day":
      return [{ key: entry.stat.date, label: entry.stat.date, share: 1 }];
    case "placement":
      return splitIntoPlacements(entry);
    case "country":
      return splitIntoCountries(entry);
    case "state":
      return splitIntoStates(entry);
    case "age":
      return splitIntoAgeBuckets(entry);
    case "gender":
      return splitIntoGenders(entry);
  }
}

function groupByBreakdown(entries: readonly WeightedStat[], breakdown: ReportBreakdown): Map<string, { label: string; entries: WeightedStat[] }> {
  const groups = new Map<string, { label: string; entries: WeightedStat[] }>();
  for (const entry of entries) {
    for (const slice of readSlicesForBreakdown(entry, breakdown)) {
      const group = groups.get(slice.key) ?? { label: slice.label, entries: [] };
      group.entries.push({ ...entry, weight: entry.weight * slice.share });
      groups.set(slice.key, group);
    }
  }
  return groups;
}

function buildDailySeries(entries: readonly WeightedStat[], currency: string, attribution: AttributionSettings, from: string, to: string): ReportSeriesPoint[] {
  const byDate = groupByBreakdown(entries, "day");
  const points: ReportSeriesPoint[] = [];
  for (let date = from; date <= to; date = new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)) {
    points.push({ date, metrics: aggregateWeightedStatsIntoMetrics(byDate.get(date)?.entries ?? [], currency, attribution) });
  }
  return points;
}

export function buildReportForQuery(accountId: string, currency: string, query: ReportQuery): ReportResponse {
  const attribution = { clickWindowDays: query.clickWindowDays, viewWindowDays: query.viewWindowDays };
  const entries = collectWeightedStats({ accountId, from: query.from, to: query.to, campaignIds: query.campaignIds });
  const comparisonEntries = query.compareFrom && query.compareTo ? collectWeightedStats({ accountId, from: query.compareFrom, to: query.compareTo, campaignIds: query.campaignIds }) : null;
  const comparisonGroups = comparisonEntries ? groupByBreakdown(comparisonEntries, query.breakdown) : null;
  const rows: ReportRow[] = [...groupByBreakdown(entries, query.breakdown).entries()].map(([key, group]) => ({
    key,
    label: group.label,
    metrics: aggregateWeightedStatsIntoMetrics(group.entries, currency, attribution),
    comparison: comparisonGroups ? aggregateWeightedStatsIntoMetrics(comparisonGroups.get(key)?.entries ?? [], currency, attribution) : null,
  }));
  rows.sort((first, second) => (query.breakdown === "day" || query.breakdown === "age" ? first.key.localeCompare(second.key) : second.metrics.spend.amountMinor - first.metrics.spend.amountMinor));
  return {
    currency,
    query,
    totals: aggregateWeightedStatsIntoMetrics(entries, currency, attribution),
    comparisonTotals: comparisonEntries ? aggregateWeightedStatsIntoMetrics(comparisonEntries, currency, attribution) : null,
    rows,
    series: buildDailySeries(entries, currency, attribution, query.from, query.to),
    comparisonSeries: comparisonEntries && query.compareFrom && query.compareTo ? buildDailySeries(comparisonEntries, currency, attribution, query.compareFrom, query.compareTo) : [],
    generatedAt: new Date().toISOString(),
  };
}
