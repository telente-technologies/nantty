package dismisssuggestion

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/users/src/container"
	usersErrors "zudomart/modules/users/src/errors"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/suggestiondismissal"
	usersservices "zudomart/modules/users/src/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, accountId, color string) error {
	if color != "blue" && color != "gold" {
		return usersErrors.NotFound("That checkmark suggestion does not exist.")
	}
	owner, err := uuid.Parse(accountId)
	if err != nil {
		return usersErrors.ErrAccountUnavailable
	}
	personal, _, err := usersservices.EnsurePersonalProfile(ctx, handler.Container, owner)
	if err != nil {
		return err
	}
	activeId, err := usersservices.ActiveProfileIdFor(ctx, handler.Container, owner, personal)
	if err != nil {
		return err
	}
	profileId, err := uuid.Parse(activeId)
	if err != nil {
		return err
	}
	err = handler.Container.Client.SuggestionDismissal.Create().SetProfileID(profileId).SetColor(suggestiondismissal.Color(color)).Exec(ctx)
	if ent.IsConstraintError(err) {
		return nil
	}
	return err
}
