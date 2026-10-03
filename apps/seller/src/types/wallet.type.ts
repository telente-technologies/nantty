import type { Money } from "@/types/money.type";

export interface WalletBalances {
  readonly escrow: Money;
  readonly pending: Money;
  readonly available: Money;
  readonly nextEscrowReleaseAt: string | null;
}

export type WalletTransactionKind = "escrow_hold" | "escrow_release" | "payout" | "refund" | "fee" | "affiliate_commission" | "ads_charge" | "subscription_charge" | "adjustment";

export interface WalletTransaction {
  readonly id: string;
  readonly kind: WalletTransactionKind;
  readonly description: string;
  readonly amount: Money;
  readonly direction: "credit" | "debit";
  readonly balanceBucket: "escrow" | "pending" | "available";
  readonly reference: string;
  readonly createdAt: string;
}

export interface PayoutAccount {
  readonly id: string;
  readonly bankName: string;
  readonly bankCode: string;
  readonly accountNameMasked: string;
  readonly accountNumberMasked: string;
  readonly isDefault: boolean;
  readonly verified: boolean;
}

export interface Payout {
  readonly id: string;
  readonly amount: Money;
  readonly fee: Money;
  readonly accountId: string;
  readonly accountSummary: string;
  readonly status: "processing" | "paid" | "failed";
  readonly reference: string;
  readonly requestedAt: string;
  readonly completedAt: string | null;
}
