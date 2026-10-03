import type { StoreCreditBalance } from "@/types";

import { api } from "./apiClient.service";

export const storeRewardsService = {
  listMyStoreCreditBalances: () => api.get<StoreCreditBalance[]>("/api/v1/store-rewards/me"),
};
