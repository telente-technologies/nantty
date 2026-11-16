import type { Money } from "@/types/api.type";
import type { ServiceHealth } from "@/types/metrics.type";

export type FinanceRange = "24h" | "7d" | "30d";
export type FinanceAspect = "all" | "orders" | "coins" | "ads" | "subscriptions" | "payouts" | "ledger";
export type FinanceReportKey = "overview" | "escrow_held" | "stuck_escrows" | "money_by_aspect" | "issues";

export interface FinanceOverview {
  readonly generatedAt: string;
  readonly range: string;
  readonly currency?: string;
  readonly gmvByCurrency: readonly Money[];
  readonly escrowHeldByCurrency: readonly Money[];
  readonly escrowReleasedByCurrency: readonly Money[];
  readonly escrowRefundedByCurrency: readonly Money[];
  readonly payoutsPendingByCurrency: readonly Money[];
  readonly coinSalesByCurrency: readonly Money[];
  readonly adTopUpsByCurrency: readonly Money[];
  readonly subscriptionByCurrency: readonly Money[];
  readonly platformRevenueByCurrency: readonly Money[];
  readonly disputesOpenCount: number;
  readonly stuckEscrowsCount: number;
  readonly payoutsPendingCount: number;
  readonly payoutsAgedCount: number;
  readonly sellerDebtAccountsCount: number;
  readonly health: readonly ServiceHealth[];
}

export interface FinanceEscrowRecord {
  readonly id: string;
  readonly orderId: string;
  readonly status: string;
  readonly amount: Money;
  readonly autoReleaseAt: string | null;
  readonly deliveredAt: string | null;
  readonly releasedAt: string | null;
  readonly refundedAt: string | null;
  readonly stuck: boolean;
}

export interface FinanceAspectRow {
  readonly group: string;
  readonly status: string;
  readonly count: number;
  readonly amountMinor: number;
  readonly currency: string;
}

export interface MoneyByAspectResponse {
  readonly aspect: FinanceAspect;
  readonly range: FinanceRange;
  readonly currency?: string;
  readonly generatedAt: string;
  readonly breakdown: readonly FinanceAspectRow[];
}

export interface FinanceIssue {
  readonly id: string;
  readonly queue: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly reference: string;
  readonly summary: string;
  readonly amount: Money | null;
  readonly severity: string;
  readonly slaHours: number;
  readonly detectedAt: string | null;
  readonly actionHref: string;
}

export interface FinanceIssuesResponse {
  readonly data: readonly FinanceIssue[];
  readonly nextCursor: string | null;
  readonly queueCounts: Readonly<Record<string, number>>;
}

export interface FinanceLookupHop {
  readonly store: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly reference: string;
  readonly status: string;
  readonly amount: Money | null;
  readonly occurredAt: string | null;
  readonly detail: string;
  readonly actionHref: string;
}

export interface FinanceLookupResult {
  readonly query: string;
  readonly found: boolean;
  readonly checkedStores: number;
  readonly message: string;
  readonly hops: readonly FinanceLookupHop[];
}

export interface FinanceReportSummary {
  readonly key: FinanceReportKey;
  readonly title: string;
  readonly description: string;
  readonly lastExport: string | null;
}

export interface FinanceExportRecord {
  readonly id: string;
  readonly reportKey: string;
  readonly actorId: string;
  readonly actorName: string;
  readonly reason: string;
  readonly occurredAt: string;
}

export interface FinanceReportsCatalog {
  readonly reports: readonly FinanceReportSummary[];
  readonly recent: readonly FinanceExportRecord[];
}
