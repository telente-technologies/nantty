import { useQuery } from "@tanstack/react-query";

import { creatorProgramService } from "@/services/creators/creatorProgram.service";
import type { CreatorDashboardPeriod } from "@/types/creator.type";

export const creatorQueryKeys = {
  eligibility: ["creator-program", "eligibility"] as const,
  application: ["creator-program", "application"] as const,
  dashboard: (period: CreatorDashboardPeriod) => ["creator-program", "dashboard", period] as const,
  affiliations: ["creator-program", "affiliations"] as const,
  revenueRules: ["creator-program", "revenue-rules"] as const,
  myPlans: ["creator-program", "my-plans"] as const,
  mySubscriptions: ["creator-program", "my-subscriptions"] as const,
  subscribers: ["creator-program", "subscribers"] as const,
  plansOfCreator: (creatorId: string) => ["creator-program", "plans", creatorId] as const,
};

export const useCreatorEligibilityQuery = () =>
  useQuery({ queryKey: creatorQueryKeys.eligibility, queryFn: creatorProgramService.fetchMyCreatorEligibility });
export const useCreatorApplicationQuery = () =>
  useQuery({ queryKey: creatorQueryKeys.application, queryFn: creatorProgramService.fetchMyCreatorApplication });
export const useCreatorRevenueRulesQuery = () =>
  useQuery({ queryKey: creatorQueryKeys.revenueRules, queryFn: creatorProgramService.fetchCreatorRevenueRules, staleTime: 3_600_000 });

export const useMySubscriptionsQuery = (enabled = true) =>
  useQuery({ queryKey: creatorQueryKeys.mySubscriptions, queryFn: creatorProgramService.listMySubscriptions, enabled });
