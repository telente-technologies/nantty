import type { NanttyWalletSummary } from "@/types/nanttyWallet.type";

import { sendRequestToStudioServer } from "./clientApi.service";

export const walletService = {
  fetchMine: () => sendRequestToStudioServer<NanttyWalletSummary>("/api/v1/wallets/me"),
};
