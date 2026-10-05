import type { StoreCreditBalance } from "@/types";

import { api } from "./apiClient.service";

export const storeRewardsService = {
  listMyStoreCreditBalances: () => api.getList<StoreCreditBalance>("/api/v1/store-rewards/me"),
};
