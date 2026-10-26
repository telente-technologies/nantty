import type { Money } from "@/types/money.type";

export interface WalletLineAmount {
  readonly amountMinor: number;
  readonly currency: string;
}

export type NanttyWalletLineKey = "available" | "pending" | "locked" | "earningsPayable" | "adCredit" | "coins" | "debts";

export interface NanttyWalletLine {
  readonly key: NanttyWalletLineKey | string;
  readonly label: string;
  readonly description: string;
  readonly amount: WalletLineAmount;
}

export interface NanttyWalletVerification {
  readonly level: number;
  readonly withdrawalsUnlocked: boolean;
  readonly waitingForVerification: Money;
  readonly nextStep: "payout_setup" | "bank_validation" | "identity_check" | "business_verification" | (string & {}) | null;
  readonly message: string | null;
}

export interface NanttyWalletSummary {
  readonly available: Money;
  readonly pending: Money;
  readonly locked?: Money;
  readonly inEscrow?: Money;
  readonly payoutRequested?: Money;
  readonly negativeBalance?: Money;
  readonly nextAvailableAt?: string | null;
  readonly adCredit?: Money;
  readonly earningsPayable?: Money;
  readonly debts?: Money;
  readonly coins?: { readonly spendable: number; readonly earned: number };
  readonly lines?: readonly NanttyWalletLine[];
  readonly verification?: NanttyWalletVerification | null;
}
