import { createSeededRandomNumberGenerator } from "@/mocks/seed/seededRandom.mock";

export interface DemoDailyTraffic {
  readonly storeViews: number;
  readonly visitors: number;
}

export interface DemoStoreTraffic {
  readonly dailyTrafficByDateKey: Map<string, DemoDailyTraffic>;
  readonly productViewWeightById: Map<string, number>;
}

const trafficHistoryLengthInDays = 760;
const weekdayTrafficMultipliers = [0.82, 1.04, 1.0, 0.97, 1.08, 1.22, 1.15];

function convertTextToSeedNumber(text: string): number {
  let hash = 2166136261;
  for (const character of text) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return hash >>> 0;
}

export function buildDemoStoreTraffic(storeId: string, productIds: readonly string[], averageOrdersPerDay: number): DemoStoreTraffic {
  const random = createSeededRandomNumberGenerator(convertTextToSeedNumber(`traffic_${storeId}`));
  const baseVisitorsPerDay = Math.max(60, Math.round(averageOrdersPerDay * 55));
  const dailyTrafficByDateKey = new Map<string, DemoDailyTraffic>();
  const today = new Date();
  for (let daysAgo = 0; daysAgo < trafficHistoryLengthInDays; daysAgo += 1) {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - daysAgo, 12));
    const growthMultiplier = 1 - daysAgo / (trafficHistoryLengthInDays * 1.8);
    const noiseMultiplier = 0.8 + random() * 0.4;
    const visitors = Math.round(baseVisitorsPerDay * growthMultiplier * noiseMultiplier * (weekdayTrafficMultipliers[date.getUTCDay()] ?? 1));
    const viewsPerVisitor = 1.6 + random() * 1.1;
    dailyTrafficByDateKey.set(date.toISOString().slice(0, 10), { visitors, storeViews: Math.round(visitors * viewsPerVisitor) });
  }
  const productViewWeightById = new Map(productIds.map((productId) => [productId, 0.3 + random() * 1.7]));
  return { dailyTrafficByDateKey, productViewWeightById };
}
