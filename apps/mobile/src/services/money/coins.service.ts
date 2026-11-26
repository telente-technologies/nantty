import type {
  CoinActivityEntry,
  CoinBalance,
  CoinConversionReceipt,
  CoinPackage,
  CoinTransferQuote,
  CoinTransferReceipt,
  Page,
  SendTipInput,
  StartedCoinPurchase,
  TipReceipt,
  VerifiedCoinPurchase,
} from "@/types";

import { api, generateIdempotencyKey } from "../core/apiClient.service";

export const coinsService = {
  fetchCoinBalance: () => api.get<CoinBalance>("/api/v1/coins/balance"),
  fetchCoinPackages: () => api.getList<CoinPackage>("/api/v1/coins/packages"),
  listCoinActivity: (cursor: string | null) => api.get<Page<CoinActivityEntry>>("/api/v1/coins/transactions", { cursor: cursor ?? undefined }),
  convertEarnedCoins: (coins: number, idempotencyKey = generateIdempotencyKey()) =>
    api.post<CoinConversionReceipt>("/api/v1/creators/earnings/convert", { coins }, { idempotencyKey }),
  startCoinPurchase: (packageId: string, idempotencyKey = generateIdempotencyKey()) =>
    api.post<StartedCoinPurchase>("/api/v1/coins/purchases", { packageId }, { idempotencyKey }),
  redeemStoreReceipt: (input: { readonly platform: "ios" | "android"; readonly productId: string; readonly receipt: string; readonly transactionId: string }, idempotencyKey = generateIdempotencyKey()) =>
    api.post<VerifiedCoinPurchase>("/api/v1/coins/iap/receipts", input, { idempotencyKey }),
  verifyCoinPurchase: (reference: string) =>
    api.post<VerifiedCoinPurchase>(`/api/v1/coins/purchases/${encodeURIComponent(reference)}/verify`),
  fetchCoinTransferQuote: (coins: number) => api.get<CoinTransferQuote>("/api/v1/coins/transfers/quote", { coins }),
  transferCoinsToUser: (recipientUserId: string, coins: number, expectedFeeBasisPoints: number, idempotencyKey = generateIdempotencyKey()) =>
    api.post<CoinTransferReceipt>("/api/v1/coins/transfers", { recipientUserId, coins, expectedFeeBasisPoints }, { idempotencyKey }),
  sendTip: (input: SendTipInput, idempotencyKey = generateIdempotencyKey()) =>
    api.post<TipReceipt>("/api/v1/tips", input, { idempotencyKey }),
};
