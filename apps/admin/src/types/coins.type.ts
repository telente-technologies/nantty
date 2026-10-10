import type { Money, PagedList, PartySummary } from "@/types/api.type";

export type CoinTransactionKind = "purchase" | "transfer";
export type CoinReviewStatus = "not_required" | "pending_review" | "reviewed" | "reversed";
export type ChargebackRisk = "low" | "medium" | "high";

export interface CoinTransaction {
  readonly id: string;
  readonly kind: CoinTransactionKind;
  readonly reference: string | null;
  readonly sender: PartySummary;
  readonly receiver: PartySummary | null;
  readonly coins: number;
  readonly feeCoins: number | null;
  readonly platformFeeBasisPoints: number | null;
  readonly fiatValue: Money | null;
  readonly paymentProvider: string | null;
  readonly channel: string | null;
  readonly transactionStatus: string;
  readonly reviewStatus: CoinReviewStatus;
  readonly reviewFlags: readonly string[];
  readonly flags: readonly string[];
  readonly chargebackRisk: ChargebackRisk;
  readonly clawbackShortfallCoins: number;
  readonly createdAt: string;
  readonly reviewedAt: string | null;
  readonly reviewedByStaffId: string | null;
  readonly reviewNote: string | null;
}

export interface CoinTransactionHistoryEntry {
  readonly action: string;
  readonly occurredAt: string;
  readonly staffId: string | null;
  readonly note: string | null;
}

export interface CoinTransactionDetail extends CoinTransaction {
  readonly history: readonly CoinTransactionHistoryEntry[];
}

export interface CoinTransactionList extends PagedList<CoinTransaction> {
  readonly counts: Readonly<Partial<Record<CoinReviewStatus, number>>>;
}
