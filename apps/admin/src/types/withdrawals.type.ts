import type { Money, PagedList, PartySummary } from "@/types/api.type";

export type WithdrawalStatus = "pending_review" | "on_hold" | "queued" | "processing" | "paid" | "failed" | "cancelled";
export type WithdrawalDecision = "approve" | "hold" | "reject";

export interface PayoutDestination {
  readonly payoutAccountId: string;
  readonly bankName: string;
  readonly accountLast4: string;
  readonly accountName: string;
  readonly countryCode: string;
  readonly addedAt: string;
  readonly removed: boolean;
}

export interface StaffWithdrawal {
  readonly id: string;
  readonly kind: string;
  readonly amount: Money;
  readonly description: string;
  readonly createdAt: string;
  readonly ageHours?: number;
  readonly status: string;
  readonly reference: string;
  readonly fee: Money;
  readonly netAmount: Money;
  readonly withdrawalStatus: WithdrawalStatus;
  readonly payoutAccountId: string;
  readonly failureReason: string | null;
  readonly processedAt: string | null;
  readonly userId: string;
  readonly user: PartySummary;
  readonly provider: string;
  readonly destination: PayoutDestination | null;
  readonly reviewedByStaffId: string | null;
  readonly reviewedAt: string | null;
  readonly reviewNote: string | null;
}

export interface RecentWithdrawal {
  readonly id: string;
  readonly amount: Money;
  readonly withdrawalStatus: WithdrawalStatus;
  readonly createdAt: string;
}

export interface StaffWithdrawalDetail extends StaffWithdrawal {
  readonly availableBalance: Money;
  readonly recentWithdrawals: readonly RecentWithdrawal[];
}

export interface StaffWithdrawalList extends PagedList<StaffWithdrawal> {
  readonly counts: Readonly<Partial<Record<WithdrawalStatus, number>>>;
}
