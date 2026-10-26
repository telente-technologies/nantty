import type { Money } from "@/types/money.type";

export interface ZudomartWalletLine {
  readonly key: string;
  readonly label: string;
  readonly description: string;
  readonly amount: Money;
}

export interface ZudomartWalletVerification {
  readonly level: number;
  readonly withdrawalsUnlocked: boolean;
  readonly waitingForVerification: Money;
  readonly nextStep: "payout_setup" | "bank_validation" | "identity_check" | "business_verification" | (string & {}) | null;
  readonly message: string | null;
}

export interface ZudomartWalletSummary {
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
  readonly lines?: readonly ZudomartWalletLine[];
  readonly verification?: ZudomartWalletVerification | null;
}

export interface AdsVerification {
  readonly level: number;
  readonly verified: boolean;
  readonly nextStep: "payout_setup" | "bank_validation" | "identity_check" | "business_verification" | (string & {}) | null;
  readonly message: string | null;
  readonly verifyUrl: string;
}

export interface EarningsFunding {
  readonly fundingId: string;
  readonly amount: Money;
  readonly status: "succeeded";
}
