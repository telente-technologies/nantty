import type { LoyaltySummary, ReferralSummary } from "@/types/rewards.type";

import { api } from "./apiClient.service";

export const rewardsService = {
  fetchMyLoyaltySummary: () => api.get<LoyaltySummary>("/api/v1/loyalty/me"),
  fetchMyReferralSummary: () => api.get<ReferralSummary>("/api/v1/referrals/me"),
};
