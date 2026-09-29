import type { AuditLogEntry } from "@/types/audit.type";
import type { Money, PagedList } from "@/types/api.type";
import type { PlatformUserSummary, RiskLevel } from "@/types/platformUser.type";

export type PayoutStatus = "PENDING" | "ON_HOLD" | "APPROVED" | "REJECTED" | "PAID";

export interface FraudAssessment {
  readonly score: number;
  readonly riskLevel: RiskLevel;
  readonly reasons: readonly string[];
  readonly modelVersion: string;
  readonly evaluatedAt: string;
}

export interface PayoutDestination {
  readonly kind: "BANK_ACCOUNT" | "MOBILE_MONEY";
  readonly institutionName: string;
  readonly accountMasked: string;
  readonly accountName: string;
  readonly addedAt: string;
}

export interface PayoutRequest {
  readonly id: string;
  readonly user: PlatformUserSummary;
  readonly amount: Money;
  readonly providerFee: Money;
  readonly netAmount: Money;
  readonly provider: string;
  readonly destination: PayoutDestination;
  readonly source: "CREATOR_EARNINGS" | "SELLER_SALES" | "WALLET";
  readonly status: PayoutStatus;
  readonly requestedAt: string;
  readonly fraud: FraudAssessment;
  readonly walletBalanceAfter: Money;
}

export interface PayoutDetail extends PayoutRequest {
  readonly recentPayouts: readonly { readonly id: string; readonly amount: Money; readonly status: PayoutStatus; readonly requestedAt: string }[];
  readonly history: readonly AuditLogEntry[];
}

export interface PayoutList extends PagedList<PayoutRequest> {
  readonly counts: Readonly<Record<PayoutStatus, number>>;
}

export type CoinTransactionKind = "PURCHASE" | "TRANSFER" | "GIFT";
export type CoinTransactionStatus = "PENDING_REVIEW" | "REVIEWED" | "REVERSED";

export interface CoinTransaction {
  readonly id: string;
  readonly kind: CoinTransactionKind;
  readonly sender: PlatformUserSummary;
  readonly receiver: PlatformUserSummary | null;
  readonly coins: number;
  readonly fiatValue: Money;
  readonly platformFee: Money | null;
  readonly platformFeeBasisPoints: number | null;
  readonly context: string;
  readonly paymentProvider: string | null;
  readonly status: CoinTransactionStatus;
  readonly flags: readonly string[];
  readonly chargebackRisk: RiskLevel;
  readonly createdAt: string;
}

export interface CoinTransactionDetail extends CoinTransaction {
  readonly history: readonly AuditLogEntry[];
}

export interface CoinTransactionList extends PagedList<CoinTransaction> {
  readonly counts: Readonly<Record<CoinTransactionStatus, number>>;
}
