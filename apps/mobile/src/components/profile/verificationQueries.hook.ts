import { useQuery } from "@tanstack/react-query";

import { verificationService } from "@/services/auth/verification.service";

export const verificationQueryKeys = { plans: ["verification", "plans"] as const, suggestions: ["verification", "suggestions"] as const, mine: ["verification", "me"] as const };

export const useVerificationPlansQuery = () => useQuery({ queryKey: verificationQueryKeys.plans, queryFn: verificationService.listVerificationPlans });
export const useMyVerificationQuery = () => useQuery({ queryKey: verificationQueryKeys.mine, queryFn: verificationService.fetchMyVerification });
export const useCheckmarkSuggestionsQuery = () => useQuery({ queryKey: verificationQueryKeys.suggestions, queryFn: verificationService.listCheckmarkSuggestions });
