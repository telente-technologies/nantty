import type { Money } from "../utils/money.util.js";

export type CoinSpendKind = "live_gift" | "post_gift" | "tip";

export interface CreatorCoinPayment {
  readonly reference: string;
  readonly kind: CoinSpendKind;
  readonly senderUserId: string;
  readonly recipientUserId: string;
  readonly coins: number;
  readonly creatorShareBasisPoints: number;
}

export type LiveGiftPayment = CreatorCoinPayment;

export interface CreatorCoinPaymentReceipt {
  readonly transactionId: string;
  readonly coinBalance: number;
  readonly creatorCoins: number;
  readonly platformCoins: number;
  readonly created: boolean;
}

export interface AffiliateCommissionCredit {
  readonly reference: string;
  readonly storeId: string;
  readonly creatorUserId: string;
  readonly amount: Money;
}

export interface EarnedCoinConversion {
  readonly reference: string;
  readonly creatorUserId: string;
  readonly coins: number;
  readonly cash: Money;
}

export interface UserWalletSummary {
  readonly userId: string;
  readonly balances: readonly Money[];
}

export interface CreatorCoinBalances {
  readonly spendableCoins: number;
  readonly earnedCoins: number;
}

export interface CreatorWallets {
  payForLiveGift(payment: CreatorCoinPayment): Promise<CreatorCoinPaymentReceipt>;
  creditAffiliateCommission(credit: AffiliateCommissionCredit): Promise<void>;
  findUserWalletSummary(userId: string): Promise<UserWalletSummary>;
  findCreatorCoinBalances(userId: string): Promise<CreatorCoinBalances>;
  convertEarnedCoinsToCash(conversion: EarnedCoinConversion): Promise<{ readonly created: boolean }>;
}
