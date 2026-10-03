import { useQuery } from "@tanstack/react-query";

import { payoutOnboardingService } from "@/services/payoutOnboarding.service";

export const payoutStateQueryKey = ["payout-onboarding", "state"] as const;

export const usePayoutStateQuery = () => useQuery({ queryKey: payoutStateQueryKey, queryFn: payoutOnboardingService.fetchState });
