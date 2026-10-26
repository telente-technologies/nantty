package services

import (
	"context"
	"net/http"

	"nantty/modules/subscriptions/src/constants"
	"nantty/modules/subscriptions/src/repositories"
	"nantty/platform/httpserver"
)

var ErrVerificationNotEligible = httpserver.NewApiError(http.StatusConflict, "VERIFICATION_NOT_ELIGIBLE", "Request verification first. We'll let you know as soon as you can apply.")

var verificationGatedPlans = map[string]bool{constants.PlanBlue: true, constants.PlanGoldOnly: true}

func (billing Billing) RequireCheckmarkPurchaseAllowed(ctx context.Context, planCode, profileId string) error {
	reader, supported := billing.Container.Identity.(repositories.CheckmarkEligibilityReader)
	if !verificationGatedPlans[planCode] || !supported {
		return nil
	}
	allowed, err := reader.CheckmarkPurchaseAllowed(ctx, profileId)
	if err != nil {
		return err
	}
	if !allowed {
		return ErrVerificationNotEligible
	}
	return nil
}
