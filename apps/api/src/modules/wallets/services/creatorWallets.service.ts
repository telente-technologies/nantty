import { isSupportedCurrencyCode } from "../../../enums/currency.enum.js";
import { unprocessable } from "../../../errors/domain.error.js";
import type {
  AffiliateCommissionCredit,
  CreatorCoinBalances,
  CreatorCoinPayment,
  CreatorCoinPaymentReceipt,
  CreatorWallets,
  EarnedCoinConversion,
  UserWalletSummary,
} from "../../../interfaces/creatorWallets.interface.js";
import type { StoreAccess } from "../../../interfaces/storeAccess.interface.js";
import { Money } from "../../../utils/money.util.js";
import type { CoinLedgerService } from "../../coins/services/coinLedger.service.js";
import { LedgerAccounts, type LedgerService } from "./ledger.service.js";

export class LedgerCreatorWallets implements CreatorWallets {
  public constructor(private readonly ledger: LedgerService, private readonly storeAccess: StoreAccess, private readonly coins: CoinLedgerService) {}

  public payForLiveGift(payment: CreatorCoinPayment): Promise<CreatorCoinPaymentReceipt> {
    return this.coins.payCreatorInCoins(payment);
  }

  public async findCreatorCoinBalances(userId: string): Promise<CreatorCoinBalances> {
    const [spendableCoins, earnedCoins] = await Promise.all([this.coins.readCoinBalance(userId), this.coins.readEarnedCoinBalance(userId)]);
    return { spendableCoins, earnedCoins };
  }

  public convertEarnedCoinsToCash(conversion: EarnedCoinConversion): Promise<{ readonly created: boolean }> {
    return this.coins.convertEarnedCoinsToCash(conversion);
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
    const walletAccounts = accounts.filter((account) => isSupportedCurrencyCode(account.currency) && account.key === LedgerAccounts.userWallet(userId, account.currency).key);
    return { userId, balances: walletAccounts.map((account) => Money.of(account.balance, account.currency)) };
  }
}
