import type { AffiliateCommissionCredit, CreatorWallets, LiveGiftPayment, UserWalletSummary } from "../../../src/interfaces/creatorWallets.interface.js";
import { insufficientFunds } from "../../../src/errors/domain.error.js";

export class FakeCreatorWallets implements CreatorWallets {
  public readonly giftPayments = new Map<string, LiveGiftPayment>();
  public readonly commissionCredits = new Map<string, AffiliateCommissionCredit>();
  public readonly brokeUserIds = new Set<string>();

  public async payForLiveGift(payment: LiveGiftPayment): Promise<void> {
    if (this.brokeUserIds.has(payment.senderUserId)) throw insufficientFunds();
    if (!this.giftPayments.has(payment.reference)) this.giftPayments.set(payment.reference, payment);
  }

  public async creditAffiliateCommission(credit: AffiliateCommissionCredit): Promise<void> {
    if (!this.commissionCredits.has(credit.reference)) this.commissionCredits.set(credit.reference, credit);
  }

  public async findUserWalletSummary(userId: string): Promise<UserWalletSummary> {
    return { userId, balances: [] };
  }
}
