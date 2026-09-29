import type { CoinPurchaseChannel, CoinPurchasePlatform } from "../../../configs/monetization.config.js";
import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { MinorUnits } from "../../../types/money.type.js";

export const COIN_PURCHASE_REFERENCE_PREFIX = "zmcoin_";

export type CoinPurchaseStatus = "pending" | "succeeded" | "failed";
export type InAppPurchaseStore = "apple" | "google";

export interface CoinPackRecord {
  readonly id: string;
  readonly name: string;
  readonly coins: number;
  readonly bonusCoins: number;
  readonly prices: Readonly<Partial<Record<CurrencyCode, MinorUnits>>>;
  readonly storeProductId: string | null;
  readonly active: boolean;
  readonly sortOrder: number;
  readonly updatedAt: Date;
}

export type CoinPackInput = Omit<CoinPackRecord, "updatedAt">;

export interface CoinPurchaseRecord {
  readonly id: string;
  readonly userId: string;
  readonly packId: string;
  readonly coins: number;
  readonly channel: CoinPurchaseChannel;
  readonly platform: CoinPurchasePlatform;
  readonly provider: string;
  readonly reference: string;
  readonly amount: MinorUnits;
  readonly currency: CurrencyCode;
  readonly status: CoinPurchaseStatus;
  readonly authorizationUrl: string | null;
  readonly providerTransactionId: string | null;
  readonly creditedAt: Date | null;
  readonly createdAt: Date;
}

export type NewCoinPurchase = Pick<CoinPurchaseRecord, "userId" | "packId" | "coins" | "channel" | "platform" | "provider" | "reference" | "amount" | "currency">;

export interface CoinPurchaseStatusChange {
  readonly providerTransactionId?: string | null;
  readonly creditedAt?: Date;
}

export function countCoinsInPack(pack: Pick<CoinPackRecord, "coins" | "bonusCoins">): number {
  return pack.coins + pack.bonusCoins;
}
