import type {
  CoinBalance,
  CoinPackage,
  CoinTransferQuote,
  CoinTransferReceipt,
  SendTipInput,
  StartedCoinPurchase,
  TipReceipt,
  VerifiedCoinPurchase,
} from "@/types";

import { api, generateIdempotencyKey } from "./apiClient.service";

export const coinsService = {
  fetchCoinBalance: () => api.get<CoinBalance>("/api/v1/coins/balance"),
  fetchCoinPackages: () => api.get<CoinPackage[]>("/api/v1/coins/packages"),
  startCoinPurchase: (packageId: string, idempotencyKey = generateIdempotencyKey()) =>
    api.post<StartedCoinPurchase>("/api/v1/coins/purchases", { packageId }, { idempotencyKey }),
  verifyCoinPurchase: (reference: string) =>
    api.post<VerifiedCoinPurchase>(`/api/v1/coins/purchases/${encodeURIComponent(reference)}/verify`),
  fetchCoinTransferQuote: (coins: number) => api.get<CoinTransferQuote>("/api/v1/coins/transfers/quote", { coins }),
  transferCoinsToUser: (recipientUserId: string, coins: number, idempotencyKey = generateIdempotencyKey()) =>
    api.post<CoinTransferReceipt>("/api/v1/coins/transfers", { recipientUserId, coins }, { idempotencyKey }),
  sendTip: (input: SendTipInput, idempotencyKey = generateIdempotencyKey()) =>
    api.post<TipReceipt>("/api/v1/tips", input, { idempotencyKey }),
};
