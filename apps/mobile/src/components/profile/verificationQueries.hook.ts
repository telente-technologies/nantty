import { useQuery } from "@tanstack/react-query";

import { verificationService } from "@/services/verification.service";

export const verificationQueryKeys = { plans: ["verification", "plans"] as const, mine: ["verification", "me"] as const };

export const useVerificationPlansQuery = () => useQuery({ queryKey: verificationQueryKeys.plans, queryFn: verificationService.listVerificationPlans });
export const useMyVerificationQuery = () => useQuery({ queryKey: verificationQueryKeys.mine, queryFn: verificationService.fetchMyVerification });
