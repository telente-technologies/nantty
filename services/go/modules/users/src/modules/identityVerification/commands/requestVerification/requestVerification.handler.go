package requestverification

import (
	"context"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	checkmarkservices "nantty/modules/users/src/modules/checkmarks/services"
	getverificationjourney "nantty/modules/users/src/modules/identityVerification/queries/getVerificationJourney"
	"nantty/modules/users/src/modules/identityVerification/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (*getverificationjourney.Eligibility, error) {
	acting, account, err := checkmarkservices.LoadActingProfile(ctx, handler.Container, command.AccountId)
	if err != nil {
		return nil, err
	}
	color, err := services.ColorForVerification(acting)
	if err != nil {
		return nil, err
	}
	if live, err := checkmarkservices.HasLiveCheckmark(ctx, handler.Container, acting.ID); err != nil || live {
		return nil, usersErrors.OrConflict(err, "ALREADY_VERIFIED", "This profile already has a checkmark.")
	}
	signals, err := services.BuildEligibilitySignals(ctx, handler.Container, acting, account, color)
	if err != nil {
		return nil, err
	}
	change, err := services.StoreEligibilityAssessment(ctx, handler.Container, acting, color, services.AssessVerificationEligibility(ctx, handler.Container, signals), true)
	if err != nil {
		return nil, err
	}
	return getverificationjourney.ConvertEligibility(change.Row), nil
}
