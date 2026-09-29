import type {
  AffiliateCommissionCredit,
  CreatorCoinBalances,
  CreatorCoinPayment,
  CreatorCoinPaymentReceipt,
  CreatorWallets,
  EarnedCoinConversion,
  UserWalletSummary,
} from "../../../src/interfaces/creatorWallets.interface.js";
import { insufficientFunds } from "../../../src/errors/domain.error.js";

export class FakeCreatorWallets implements CreatorWallets {
  public readonly giftPayments = new Map<string, CreatorCoinPayment>();
  public readonly commissionCredits = new Map<string, AffiliateCommissionCredit>();
  public readonly brokeUserIds = new Set<string>();

  public async payForLiveGift(payment: CreatorCoinPayment): Promise<CreatorCoinPaymentReceipt> {
    if (this.brokeUserIds.has(payment.senderUserId)) throw insufficientFunds();
    const created = !this.giftPayments.has(payment.reference);
    if (created) this.giftPayments.set(payment.reference, payment);
    const creatorCoins = Math.floor((payment.coins * payment.creatorShareBasisPoints) / 10_000);
    return { transactionId: payment.reference, coinBalance: 1_000, creatorCoins, platformCoins: payment.coins - creatorCoins, created };
  }

  public async creditAffiliateCommission(credit: AffiliateCommissionCredit): Promise<void> {
    if (!this.commissionCredits.has(credit.reference)) this.commissionCredits.set(credit.reference, credit);
  }

  public async findUserWalletSummary(userId: string): Promise<UserWalletSummary> {
    return { userId, balances: [] };
  }

  public async findCreatorCoinBalances(): Promise<CreatorCoinBalances> {
    return { spendableCoins: 0, earnedCoins: 0 };
  }

  public async convertEarnedCoinsToCash(_conversion: EarnedCoinConversion): Promise<{ readonly created: boolean }> {
    return { created: true };
  }
}
