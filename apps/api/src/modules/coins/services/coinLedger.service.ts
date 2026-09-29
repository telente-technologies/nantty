import { unprocessable } from "../../../errors/domain.error.js";
import type { CreatorCoinPayment, CreatorCoinPaymentReceipt, EarnedCoinConversion } from "../../../interfaces/creatorWallets.interface.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { MonetizationLedgerAccounts } from "../../wallets/constants/monetizationLedgerAccounts.constant.js";
import { COIN_LEDGER_UNIT, type LedgerAccountSpecification, type LedgerEntryRecord, type LedgerLineInput, type LedgerPostingResult } from "../../wallets/models/wallets.model.js";
import { LedgerAccounts, type LedgerService } from "../../wallets/services/ledger.service.js";

const MAX_BASIS_POINTS = 10_000;

export interface CoinTransferPosting {
  readonly reference: string;
  readonly senderUserId: string;
  readonly recipientUserId: string;
  readonly coins: number;
  readonly feeBasisPoints: number;
  readonly description: string;
}

export interface CoinTransferPosted {
  readonly transactionId: string;
  readonly coins: number;
  readonly feeCoins: number;
  readonly netCoins: number;
  readonly balance: number;
  readonly created: boolean;
}

export interface CoinCredit {
  readonly reference: string;
  readonly kind: string;
  readonly description: string;
  readonly userId: string;
  readonly coins: number;
  readonly fiatLines: readonly LedgerLineInput[];
}

export function splitCoinsByBasisPoints(coins: number, shareBasisPoints: number): { readonly share: number; readonly remainder: number } {
  const share = Number((BigInt(coins) * BigInt(shareBasisPoints)) / BigInt(MAX_BASIS_POINTS));
  return { share, remainder: coins - share };
}

function coinLine(account: LedgerAccountSpecification, direction: "debit" | "credit", amount: number): LedgerLineInput {
  return { account, direction, amount, currency: COIN_LEDGER_UNIT };
}

function assertWholePositiveCoins(coins: number): void {
  if (!Number.isSafeInteger(coins) || coins <= 0) throw unprocessable("Coin amounts must be positive whole numbers.");
}

function assertBasisPoints(basisPoints: number): void {
  if (!Number.isInteger(basisPoints) || basisPoints < 0 || basisPoints > MAX_BASIS_POINTS) throw unprocessable("Shares must be between 0 and 10000 basis points.");
}

export class CoinLedgerService {
  public constructor(public readonly ledger: LedgerService) {}

  public readCoinBalance(userId: string): Promise<number> {
    return this.ledger.readAccountBalance(MonetizationLedgerAccounts.userCoins(userId));
  }

  public readEarnedCoinBalance(userId: string): Promise<number> {
    return this.ledger.readAccountBalance(MonetizationLedgerAccounts.creatorEarnedCoins(userId));
  }

  public listCoinEntries(userId: string, page: PageRequest): Promise<Page<LedgerEntryRecord>> {
    return this.ledger.repository.listEntriesForAccount(MonetizationLedgerAccounts.userCoins(userId).key, page);
  }

  public async creditCoins(credit: CoinCredit): Promise<LedgerPostingResult> {
    assertWholePositiveCoins(credit.coins);
    return this.ledger.postLedgerTransaction({
      reference: credit.reference,
      kind: credit.kind,
      description: credit.description,
      lines: [
        ...credit.fiatLines,
        coinLine(MonetizationLedgerAccounts.coinsInCirculation(), "debit", credit.coins),
        coinLine(MonetizationLedgerAccounts.userCoins(credit.userId), "credit", credit.coins),
      ],
    });
  }

  public async payCreatorInCoins(payment: CreatorCoinPayment): Promise<CreatorCoinPaymentReceipt> {
    assertWholePositiveCoins(payment.coins);
    assertBasisPoints(payment.creatorShareBasisPoints);
    if (payment.senderUserId === payment.recipientUserId) throw unprocessable("You cannot send coins to yourself.");
    const { share: creatorCoins, remainder: platformCoins } = splitCoinsByBasisPoints(payment.coins, payment.creatorShareBasisPoints);
    const lines = [coinLine(MonetizationLedgerAccounts.userCoins(payment.senderUserId), "debit", payment.coins)];
    if (creatorCoins > 0) lines.push(coinLine(MonetizationLedgerAccounts.creatorEarnedCoins(payment.recipientUserId), "credit", creatorCoins));
    if (platformCoins > 0) lines.push(coinLine(MonetizationLedgerAccounts.platformCoinFees(), "credit", platformCoins));
    const posted = await this.ledger.postLedgerTransaction({ reference: payment.reference, kind: payment.kind, description: `Coins spent on a ${payment.kind.replace("_", " ")}`, lines });
    return { transactionId: posted.transaction.id, coinBalance: await this.readCoinBalance(payment.senderUserId), creatorCoins, platformCoins, created: posted.created };
  }

  public async transferCoins(transfer: CoinTransferPosting): Promise<CoinTransferPosted> {
    assertWholePositiveCoins(transfer.coins);
    assertBasisPoints(transfer.feeBasisPoints);
    if (transfer.senderUserId === transfer.recipientUserId) throw unprocessable("You cannot send coins to yourself.");
    const { share: feeCoins, remainder: netCoins } = splitCoinsByBasisPoints(transfer.coins, transfer.feeBasisPoints);
    if (netCoins <= 0) throw unprocessable("This transfer is too small to cover the platform fee.");
    const lines = [
      coinLine(MonetizationLedgerAccounts.userCoins(transfer.senderUserId), "debit", transfer.coins),
      coinLine(MonetizationLedgerAccounts.userCoins(transfer.recipientUserId), "credit", netCoins),
    ];
    if (feeCoins > 0) lines.push(coinLine(MonetizationLedgerAccounts.platformCoinFees(), "credit", feeCoins));
    const posted = await this.ledger.postLedgerTransaction({ reference: transfer.reference, kind: "coin_transfer", description: transfer.description, lines });
    return { transactionId: posted.transaction.id, coins: transfer.coins, feeCoins, netCoins, balance: await this.readCoinBalance(transfer.senderUserId), created: posted.created };
  }

  public async convertEarnedCoinsToCash(conversion: EarnedCoinConversion): Promise<{ readonly created: boolean }> {
    assertWholePositiveCoins(conversion.coins);
    if (conversion.cash.amountMinor <= 0) throw unprocessable("The converted amount must be positive.");
    const { amountMinor, currency } = conversion.cash;
    const posted = await this.ledger.postLedgerTransaction({
      reference: conversion.reference,
      kind: "creator_coin_conversion",
      description: "Earned coins converted to cash",
      lines: [
        coinLine(MonetizationLedgerAccounts.creatorEarnedCoins(conversion.creatorUserId), "debit", conversion.coins),
        coinLine(MonetizationLedgerAccounts.coinsInCirculation(), "credit", conversion.coins),
        { account: MonetizationLedgerAccounts.creatorCoinPayoutExpense(currency), direction: "debit", amount: amountMinor, currency },
        { account: LedgerAccounts.userWallet(conversion.creatorUserId, currency), direction: "credit", amount: amountMinor, currency },
      ],
    });
    return { created: posted.created };
  }
}
