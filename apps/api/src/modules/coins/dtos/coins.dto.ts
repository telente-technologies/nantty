import { Money, type MoneyDto } from "../../../utils/money.util.js";
import type { LedgerEntryRecord } from "../../wallets/models/wallets.model.js";
import type { CoinPurchaseRecord } from "../models/coins.model.js";

export interface CoinPackDto {
  readonly id: string;
  readonly name: string;
  readonly coins: number;
  readonly bonusCoins: number;
  readonly totalCoins: number;
  readonly storeProductId: string | null;
  readonly active: boolean;
  readonly price: MoneyDto;
  readonly prices: readonly MoneyDto[];
}

export function convertCoinPurchaseToDto(purchase: CoinPurchaseRecord) {
  return {
    id: purchase.id,
    reference: purchase.reference,
    packId: purchase.packId,
    coins: purchase.coins,
    channel: purchase.channel,
    provider: purchase.provider,
    amount: Money.of(purchase.amount, purchase.currency).toDto(),
    status: purchase.status,
    creditedAt: purchase.creditedAt?.toISOString() ?? null,
    createdAt: purchase.createdAt.toISOString(),
  };
}

export function convertCoinEntryToDto(entry: LedgerEntryRecord) {
  return {
    id: entry.id,
    transactionId: entry.transactionId,
    type: entry.direction === "credit" ? "credit" : "debit",
    coins: entry.amount,
    balanceAfter: entry.balanceAfter,
    createdAt: entry.createdAt.toISOString(),
  };
}
