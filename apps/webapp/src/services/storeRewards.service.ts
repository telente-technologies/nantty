import type { StoreCreditBalance } from "@/types";

import { sendRequestToWebappServer } from "./clientApi.service";

export const storeRewardsService = {
  listMyStoreCreditBalances: () => sendRequestToWebappServer<StoreCreditBalance[]>("/api/v1/store-rewards/me"),
};
