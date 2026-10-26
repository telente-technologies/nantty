package services

import (
	"slices"

	adminerrors "nantty/modules/admin/src/errors"
)

const fullAdLoadPercent = 100

var DefaultAdLoadPercentByPlanKey = map[string]int{
	"BLUE_ESSENTIAL": 75, "BLUE_VERIFIED": 60, "BLUE_PREMIUM": 0,
	"GOLD_ONLY": 50, "GOLD_PRO": 50, "GOLD_BUSINESS": 0, "GOLD_PREMIUM": 0,
	"BLACK_OFFICIAL": 20,
}

var adFreeTiers = map[string][]string{"BLUE": {"PREMIUM"}, "GOLD": {"BUSINESS", "PREMIUM"}}

func IsAdFreePlanTier(color, tier string) bool {
	return slices.Contains(adFreeTiers[color], tier)
}

func validatePlanAdLoad(plan VerificationPlan) error {
	if plan.AdLoadPercent == nil {
		return nil
	}
	if IsAdFreePlanTier(plan.Color, plan.Tier) && *plan.AdLoadPercent != 0 {
		return adminerrors.Unprocessable(plan.PlanKey + " is ad-free: its ad load is locked at 0%.")
	}
	return requireWithin(plan.PlanKey+".adLoadPercent", *plan.AdLoadPercent, 0, fullAdLoadPercent)
}
