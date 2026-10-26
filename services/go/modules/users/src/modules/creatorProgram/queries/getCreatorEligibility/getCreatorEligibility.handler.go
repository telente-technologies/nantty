package getcreatoreligibility

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/modules/creatorProgram/services"
	usersservices "nantty/modules/users/src/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, accountId string) (services.Eligibility, error) {
	owner, err := uuid.Parse(accountId)
	if err != nil {
		return services.Eligibility{}, usersErrors.ErrAccountUnavailable
	}
	personal, summary, err := usersservices.EnsurePersonalProfile(ctx, handler.Container, owner)
	if err != nil {
		return services.Eligibility{}, err
	}
	return services.EvaluateCreatorEligibility(ctx, handler.Container, personal, summary)
}
