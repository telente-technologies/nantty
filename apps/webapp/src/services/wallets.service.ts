import type { CoinBalance, WalletSummary } from "@/types";

import { sendRequestToWebappServer } from "./clientApi.service";

export const walletsService = {
  fetchMyWalletSummary: () => sendRequestToWebappServer<WalletSummary>("/api/v1/wallets/me"),
  fetchMyCoinBalance: () => sendRequestToWebappServer<CoinBalance>("/api/v1/coins/balance"),
};
