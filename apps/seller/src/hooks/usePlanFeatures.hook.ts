"use client";

import { useCallback, useMemo } from "react";

import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { convertAccessToSellerPlan, isFeatureIncludedInPlan, minimumPlanByFeature, planLimitsByPlan, type PlanFeature, type SellerPlan, type SellerPlanLimits } from "@/config/planFeatures.config";

export interface PlanFeaturesState {
  readonly plan: SellerPlan;
  readonly limits: SellerPlanLimits;
  readonly hasFeature: (feature: PlanFeature) => boolean;
  readonly readRequiredPlan: (feature: PlanFeature) => SellerPlan;
}

export function usePlanFeatures(): PlanFeaturesState {
  const { sessionView } = useSellerSession();
  const plan = convertAccessToSellerPlan(sessionView?.access);
  const hasFeature = useCallback((feature: PlanFeature) => isFeatureIncludedInPlan(feature, plan), [plan]);
  const readRequiredPlan = useCallback((feature: PlanFeature) => minimumPlanByFeature[feature], []);
  return useMemo(() => ({ plan, limits: planLimitsByPlan[plan], hasFeature, readRequiredPlan }), [plan, hasFeature, readRequiredPlan]);
}
