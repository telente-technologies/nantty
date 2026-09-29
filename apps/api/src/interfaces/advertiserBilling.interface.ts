import type { Money } from "../utils/money.util.js";

export interface AdvertiserAccount {
  readonly type: "store" | "user";
  readonly id: string;
}

export interface AdvertiserCharge {
  readonly reference: string;
  readonly advertiser: AdvertiserAccount;
  readonly amount: Money;
  readonly description: string;
}

export interface AdRevenueShareCredit {
  readonly reference: string;
  readonly creatorUserId: string;
  readonly amount: Money;
}

export interface AdvertiserBilling {
  chargeAdvertiserWallet(charge: AdvertiserCharge): Promise<void>;
  refundAdvertiserWallet(charge: AdvertiserCharge): Promise<void>;
  findAdvertiserWalletBalance(advertiser: AdvertiserAccount, currency: Money["currency"]): Promise<Money>;
  creditCreatorAdRevenueShare(credit: AdRevenueShareCredit): Promise<void>;
}
