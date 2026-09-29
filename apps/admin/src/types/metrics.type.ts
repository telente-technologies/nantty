import type { Money } from "@/types/api.type";

export type MetricsRange = "24h" | "7d" | "30d";

export interface AttentionQueueSummary {
  readonly key: string;
  readonly label: string;
  readonly href: string;
  readonly count: number;
  readonly oldestAt: string | null;
  readonly breachingSla: number;
}

export interface ServiceHealth {
  readonly name: string;
  readonly status: "OPERATIONAL" | "DEGRADED" | "DOWN";
  readonly latencyMs: number | null;
  readonly note: string | null;
}

export interface OverviewMetrics {
  readonly generatedAt: string;
  readonly range: MetricsRange;
  readonly users: { readonly total: number; readonly newInRange: number; readonly dailyActive: number; readonly monthlyActive: number; readonly dailyActiveSeries: readonly number[] };
  readonly commerce: {
    readonly ordersInRange: number;
    readonly ordersSeries: readonly number[];
    readonly gmvByCurrency: readonly Money[];
    readonly escrowHeldByCurrency: readonly Money[];
    readonly escrowReleasedByCurrency: readonly Money[];
    readonly disputesOpen: number;
  };
  readonly money: {
    readonly payoutsPendingCount: number;
    readonly payoutsPendingByCurrency: readonly Money[];
    readonly creatorPayoutsByCurrency: readonly Money[];
    readonly adsSpendByCurrency: readonly Money[];
  };
  readonly trust: { readonly reportsPending: number; readonly appealsPending: number; readonly copyrightPending: number; readonly verificationPending: number };
  readonly queues: readonly AttentionQueueSummary[];
  readonly health: readonly ServiceHealth[];
}
