import { unprocessable } from "../../../errors/domain.error.js";
import type { AffiliateCommissionCredit, CreatorWallets, LiveGiftPayment, UserWalletSummary } from "../../../interfaces/creatorWallets.interface.js";
import type { StoreAccess } from "../../../interfaces/storeAccess.interface.js";
import { Money } from "../../../utils/money.util.js";
import type { LedgerLineInput } from "../models/wallets.model.js";
import { LedgerAccounts, type LedgerService } from "./ledger.service.js";

export class LedgerCreatorWallets implements CreatorWallets {
  public constructor(private readonly ledger: LedgerService, private readonly storeAccess: StoreAccess) {}

  public async payForLiveGift(payment: LiveGiftPayment): Promise<void> {
    const { amount, senderUserId, recipientUserId, platformCutBasisPoints } = payment;
    if (amount.amountMinor <= 0) throw unprocessable("Gift amounts must be positive.");
    if (senderUserId === recipientUserId) throw unprocessable("You cannot send a gift to yourself.");
    if (!Number.isInteger(platformCutBasisPoints) || platformCutBasisPoints < 0 || platformCutBasisPoints > 10_000) throw unprocessable("The platform cut must be between 0 and 10000 basis points.");
    const platformCut = amount.calculateBasisPointsShareRoundingDown(platformCutBasisPoints);
    const recipientShare = amount.subtract(platformCut);
    const lines: LedgerLineInput[] = [{ account: LedgerAccounts.userWallet(senderUserId, amount.currency), direction: "debit", amount: amount.amountMinor, currency: amount.currency }];
    if (recipientShare.amountMinor > 0) lines.push({ account: LedgerAccounts.userWallet(recipientUserId, amount.currency), direction: "credit", amount: recipientShare.amountMinor, currency: amount.currency });
    if (platformCut.amountMinor > 0) lines.push({ account: LedgerAccounts.platformCommission(amount.currency), direction: "credit", amount: platformCut.amountMinor, currency: amount.currency });
    await this.ledger.postLedgerTransaction({ reference: `live-gift:${payment.reference}`, kind: "live_gift", description: "Live gift", lines });
  }

  public async creditAffiliateCommission(credit: AffiliateCommissionCredit): Promise<void> {
    if (credit.amount.amountMinor <= 0) throw unprocessable("Commission amounts must be positive.");
    const [store] = await this.storeAccess.findStoreSummaries([credit.storeId]);
    if (store === undefined) throw unprocessable("The store for this commission does not exist.");
    if (store.currency !== credit.amount.currency) throw unprocessable("The commission currency must match the store currency.");
    const { amountMinor, currency } = credit.amount;
    await this.ledger.postLedgerTransaction({
      reference: `affiliate-commission:${credit.reference}`,
      kind: "affiliate_commission",
      description: `Affiliate commission from store ${credit.storeId}`,
      lines: [
        { account: LedgerAccounts.storeWallet(credit.storeId, currency), direction: "debit", amount: amountMinor, currency },
        { account: LedgerAccounts.userWallet(credit.creatorUserId, currency), direction: "credit", amount: amountMinor, currency },
      ],
    });
  }

  public async findUserWalletSummary(userId: string): Promise<UserWalletSummary> {
    const accounts = await this.ledger.repository.listAccountsForOwner("user", userId);
    const walletAccounts = accounts.filter((account) => account.key === LedgerAccounts.userWallet(userId, account.currency).key);
    return { userId, balances: walletAccounts.map((account) => Money.of(account.balance, account.currency)) };
  }
}
