import { useQuery } from "@tanstack/react-query";

import { payoutOnboardingService } from "@/services/commerce/payoutOnboarding.service";

export const payoutQueryKeys = {
  state: ["payoutOnboarding", "state"] as const,
  fees: ["payoutOnboarding", "fees"] as const,
};

export const usePayoutOnboardingQuery = () =>
  useQuery({
    queryKey: payoutQueryKeys.state,
    queryFn: payoutOnboardingService.fetchState,
    refetchInterval: (query) => (query.state.data?.status === "pending_review" ? 5000 : false),
  });

export const usePayoutFeesQuery = () => useQuery({ queryKey: payoutQueryKeys.fees, queryFn: payoutOnboardingService.fetchPayoutFees });
