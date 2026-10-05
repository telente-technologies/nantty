import type { StoreCreditBalance } from "@/types";

import { sendListRequestToWebappServer } from "./clientApi.service";

export const storeRewardsService = {
  listMyStoreCreditBalances: () => sendListRequestToWebappServer<StoreCreditBalance>("/api/v1/store-rewards/me"),
};
