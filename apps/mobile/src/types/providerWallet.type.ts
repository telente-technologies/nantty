import type { WalletDailyLimits } from "@/utils/walletLimits.util";

import type { Money } from "./money.type";

export type PaymentsProvider = "flutterwave";

export interface WalletFundingNumber {
  readonly accountNumber: string;
  readonly bankName: string;
}

export interface ProviderWallet {
  readonly provider: PaymentsProvider | string;
  readonly currency: string;
  readonly status: "active" | "frozen" | "closed" | string;
  readonly accountName: string;
  readonly accountNumber: string;
  readonly bankName: string;
  readonly bankCode: string;
  readonly fundingNumbers: readonly WalletFundingNumber[];
  readonly createdAt: string;
  readonly frozenAt: string | null;
}

export interface ProviderWalletBalances {
  readonly currency: string;
  readonly availableMinor: number;
  readonly depositHoldMinor: number;
  readonly escrowLockedMinor: number;
  readonly outgoingMinor: number;
  readonly reservedPayoutMinor: number;
  readonly debtMinor: number;
}

export interface MyProviderWallet {
  readonly wallet: ProviderWallet;
  readonly balances: ProviderWalletBalances;
  readonly limits?: WalletDailyLimits;
}

export interface PaymentVerificationLevel {
  readonly level: number;
  readonly payoutVerified: boolean;
  readonly identityVerified: boolean;
  readonly country: string;
  readonly method: string | null;
  readonly nextStep: string | null;
}

export interface PaymentIntentView {
  readonly reference: string;
  readonly provider: PaymentsProvider | string;
  readonly status: string;
  readonly amount: Money;
  readonly checkoutUrl: string | null;
  readonly authorizationUrl: string | null;
}

export type BvnConsentStatus = "not_started" | "pending" | "verified" | "failed" | "manual_review" | string;

export interface BvnConsentStart {
  readonly status: BvnConsentStatus;
  readonly consentUrl?: string;
  readonly reference?: string;
}

export const walletSpendableMinor = (balances: ProviderWalletBalances): number => Math.max(balances.availableMinor + balances.depositHoldMinor - balances.debtMinor, 0);
