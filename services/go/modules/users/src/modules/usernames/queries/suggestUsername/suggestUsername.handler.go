package suggestusername

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/services"
	"nantty/platform/usernames"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (Result, error) {
	requester, _ := uuid.Parse(query.AccountId)
	rules, err := services.ListReservedRules(ctx, handler.Container.Client)
	if err != nil {
		return Result{}, err
	}
	for _, candidate := range usernames.GenerateCandidates([]string{query.Seed}, rules) {
		username, verdict, err := services.JudgeUsername(ctx, handler.Container, candidate, requester, true)
		if err != nil {
			return Result{}, err
		}
		if verdict.Available {
			return Result{Username: username}, nil
		}
	}
	return Result{}, usersErrors.Unprocessable("Could not suggest a username. Choose one yourself.")
}
