import type { ZudomartWalletSummary } from "@/types/zudomartWallet.type";

import { sendRequestToStudioServer } from "./clientApi.service";

export const walletService = {
  fetchMine: () => sendRequestToStudioServer<ZudomartWalletSummary>("/api/v1/wallets/me"),
};
