import type { Money } from "@/types/money.type";
import type { EscrowStatus } from "@/types/order.type";
import type { WalletBalances, WalletTransaction } from "@/types/wallet.type";

export type FinanceFeeKind = "escrow_fee" | "payment_processing" | "withdrawal" | "ads" | "subscription";

export interface EscrowEntry {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly buyerName: string;
  readonly buyerUsername: string;
  readonly gross: Money;
  readonly fees: Money;
  readonly net: Money;
  readonly status: EscrowStatus;
  readonly heldAt: string;
  readonly releaseExpectedAt: string | null;
  readonly releasedAt: string | null;
  readonly settlementId: string | null;
}

export interface EscrowEntriesPage {
  readonly data: EscrowEntry[];
  readonly nextCursor: string | null;
  readonly countsByStatus: Record<EscrowStatus, number>;
  readonly totalsByStatus: Record<EscrowStatus, Money>;
}

export interface Settlement {
  readonly id: string;
  readonly reference: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly ordersCount: number;
  readonly gross: Money;
  readonly fees: Money;
  readonly net: Money;
  readonly status: "settled" | "clearing";
  readonly settledAt: string;
}

export interface SettlementDetail {
  readonly settlement: Settlement;
  readonly orders: EscrowEntry[];
}

export interface FinanceFeeLine {
  readonly kind: FinanceFeeKind;
  readonly label: string;
  readonly description: string;
  readonly rateBasisPoints: number | null;
  readonly count: number;
  readonly amount: Money;
}

export interface FinanceFeeBreakdown {
  readonly from: string;
  readonly to: string;
  readonly grossSales: Money;
  readonly totalFees: Money;
  readonly netEarnings: Money;
  readonly lines: FinanceFeeLine[];
}

export interface RefundEntry {
  readonly id: string;
  readonly orderId: string;
  readonly orderNumber: string;
  readonly buyerName: string;
  readonly kind: "cancelled_before_shipping" | "refunded_order" | "approved_return";
  readonly reason: string;
  readonly amount: Money;
  readonly feesReturned: Money;
  readonly createdAt: string;
}

export interface FinanceSummary {
  readonly from: string;
  readonly to: string;
  readonly balances: WalletBalances;
  readonly grossSales: Money;
  readonly totalFees: Money;
  readonly refunds: Money;
  readonly netEarnings: Money;
  readonly paidOut: Money;
  readonly ordersCount: number;
  readonly upcomingReleases: EscrowEntry[];
}

export interface StatementMonthSummary {
  readonly month: string;
  readonly openingBalance: Money;
  readonly credits: Money;
  readonly debits: Money;
  readonly closingBalance: Money;
  readonly transactionsCount: number;
}

export interface StatementLine extends WalletTransaction {
  readonly runningBalance: Money;
}

export interface StatementDetail {
  readonly summary: StatementMonthSummary;
  readonly storeName: string;
  readonly storeAddress: string;
  readonly generatedAt: string;
  readonly lines: StatementLine[];
}

export type PayoutScheduleMode = "manual" | "daily" | "weekly" | "monthly";

export interface PayoutSchedule {
  readonly mode: PayoutScheduleMode;
  readonly weekday: number;
  readonly dayOfMonth: number;
  readonly keepMinimumBalance: Money;
  readonly accountId: string | null;
  readonly nextRunAt: string | null;
}
