import type { Money } from "@/types/money.type";

export interface WalletPayoutSettings {
  readonly minimumPayout: Money;
  readonly fee: Money;
  readonly schedule: string;
}

export interface WalletBank {
  readonly code: string;
  readonly name: string;
}

export interface WalletBankBranch {
  readonly code: string;
  readonly name: string;
}

export interface ResolvedPayoutAccount {
  readonly resolutionId: string;
  readonly bankCode: string;
  readonly bankName: string;
  readonly accountNameMasked: string;
  readonly accountNumberMasked: string;
}
