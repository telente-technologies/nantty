export interface ProviderWalletView {
  readonly provider: string;
  readonly currency: string;
  readonly status: string;
  readonly accountName: string;
  readonly accountNumber: string;
  readonly bankName: string;
  readonly bankCode: string;
  readonly fundingNumbers: readonly { readonly accountNumber: string; readonly bankName: string }[];
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
  readonly wallet: ProviderWalletView;
  readonly balances: ProviderWalletBalances;
}

export interface MyVerificationLevel {
  readonly level: number;
  readonly payoutVerified: boolean;
  readonly identityVerified: boolean;
  readonly country: string;
  readonly method: string | null;
  readonly nextStep: string | null;
}
