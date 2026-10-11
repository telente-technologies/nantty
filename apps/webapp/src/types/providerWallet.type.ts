import type { WalletDailyLimits } from "@/utils/walletLimits.util";

export interface WalletFundingNumber {
  readonly accountNumber: string;
  readonly bankName: string;
}

export interface ProviderWallet {
  readonly provider: string;
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

export interface ProviderWalletResponse {
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

export interface WalletPaymentResult {
  readonly reference: string;
  readonly status: string;
  readonly provider: string;
}
