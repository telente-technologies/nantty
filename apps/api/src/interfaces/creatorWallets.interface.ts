import type { Money } from "../utils/money.util.js";

export interface LiveGiftPayment {
  readonly reference: string;
  readonly senderUserId: string;
  readonly recipientUserId: string;
  readonly amount: Money;
  readonly platformCutBasisPoints: number;
}

export interface AffiliateCommissionCredit {
  readonly reference: string;
  readonly storeId: string;
  readonly creatorUserId: string;
  readonly amount: Money;
}

export interface UserWalletSummary {
  readonly userId: string;
  readonly balances: readonly Money[];
}

export interface CreatorWallets {
  payForLiveGift(payment: LiveGiftPayment): Promise<void>;
  creditAffiliateCommission(credit: AffiliateCommissionCredit): Promise<void>;
  findUserWalletSummary(userId: string): Promise<UserWalletSummary>;
}
