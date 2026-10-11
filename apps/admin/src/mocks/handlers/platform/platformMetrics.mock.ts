import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { requireMockPermission } from "@/mocks/mockGuards.mock";
import { readEveryMockQueueCounter } from "@/mocks/mockQueueCounters.mock";
import { respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import type { MetricsRange, OverviewMetrics } from "@/types/metrics.type";

const rangeMultiplier: Record<MetricsRange, number> = { "24h": 1, "7d": 7, "30d": 30 };

function buildSeries(length: number, base: number, swing: number): number[] {
  return Array.from({ length }, (_, index) => Math.round(base + Math.sin(index / 2.3) * swing + ((index * 7919) % 97) * (swing / 120)));
}

function readQueueCount(key: string): number {
  return readEveryMockQueueCounter().find((counter) => counter.key === key)?.readCount().count ?? 0;
}

export function registerPlatformMetricsMockHandlers(): void {
  registerMockRoute("GET", "/admin/metrics/overview", (request) => {
    requireMockPermission(request, "metrics:read");
    const requestedRange = request.query.get("range");
    const range: MetricsRange = requestedRange === "7d" || requestedRange === "30d" ? requestedRange : "24h";
    const days = rangeMultiplier[range];
    const queues = readEveryMockQueueCounter().map((counter) => {
      const reading = counter.readCount();
      return { key: counter.key, label: counter.label, href: counter.href, count: reading.count, oldestAt: reading.oldestAt, breachingSla: reading.breachingSla ?? 0 };
    });
    const metrics: OverviewMetrics = {
      generatedAt: new Date().toISOString(),
      range,
      users: { total: 2_418_730 + readMockDatabase().platformUsers.length, newInRange: 6_140 * days, dailyActive: 412_880, monthlyActive: 1_386_200, dailyActiveSeries: buildSeries(14, 405_000, 18_000) },
      commerce: {
        ordersInRange: 18_420 * days,
        ordersSeries: buildSeries(14, 18_000, 2_400),
        gmvByCurrency: [
          { amountMinor: 412_750_000_00 * days, currency: "NGN" },
          { amountMinor: 1_284_300_00 * days, currency: "GHS" },
          { amountMinor: 9_870_450_00 * days, currency: "KES" },
          { amountMinor: 42_310_00 * days, currency: "GBP" },
        ],
        escrowHeldByCurrency: [
          { amountMinor: 1_096_420_000_00, currency: "NGN" },
          { amountMinor: 3_802_150_00, currency: "GHS" },
          { amountMinor: 28_450_900_00, currency: "KES" },
        ],
        escrowReleasedByCurrency: [
          { amountMinor: 371_900_000_00 * days, currency: "NGN" },
          { amountMinor: 1_102_000_00 * days, currency: "GHS" },
        ],
        disputesOpen: readQueueCount("disputes") || 47,
      },
      money: {
        payoutsPendingCount: readQueueCount("payouts") || 132,
        payoutsPendingByCurrency: [
          { amountMinor: 184_650_000_00, currency: "NGN" },
          { amountMinor: 402_300_00, currency: "GHS" },
        ],
        creatorPayoutsByCurrency: [
          { amountMinor: 38_420_000_00 * days, currency: "NGN" },
          { amountMinor: 118_000_00 * days, currency: "GHS" },
        ],
        adsSpendByCurrency: [
          { amountMinor: 64_300_000_00 * days, currency: "NGN" },
          { amountMinor: 2_150_00 * days, currency: "GBP" },
        ],
      },
      trust: {
        reportsPending: readQueueCount("reports") || 318,
        appealsPending: readQueueCount("appeals") || 26,
        copyrightPending: readQueueCount("copyright") || 14,
        verificationPending: readQueueCount("verification") || 58,
      },
      queues,
      health: [
        { name: "API", status: "OPERATIONAL", latencyMs: 84, note: null },
        { name: "Payments (Flutterwave)", status: "OPERATIONAL", latencyMs: 312, note: null },
        { name: "Payments (Flutterwave)", status: "DEGRADED", latencyMs: 1_840, note: "Transfers to GTBank slower than usual since 09:40." },
        { name: "Media processing", status: "OPERATIONAL", latencyMs: null, note: "HLS queue 214 jobs" },
        { name: "Intelligence service", status: "OPERATIONAL", latencyMs: 46, note: null },
        { name: "Live streaming", status: "OPERATIONAL", latencyMs: 120, note: "1,284 lives now" },
      ],
    };
    return respondWithJson(200, metrics);
  });
}
