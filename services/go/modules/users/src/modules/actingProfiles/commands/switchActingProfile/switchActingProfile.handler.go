package switchactingprofile

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/actingprofile"
	"nantty/modules/users/src/services"
	"nantty/modules/users/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (types.ActingProfileView, error) {
	owner, ownerErr := uuid.Parse(command.AccountId)
	target, targetErr := uuid.Parse(command.ProfileId)
	if ownerErr != nil || targetErr != nil {
		return types.ActingProfileView{}, usersErrors.ErrActingProfileInvalid
	}
	personal, _, err := services.EnsurePersonalProfile(ctx, handler.Container, owner)
	if err != nil {
		return types.ActingProfileView{}, err
	}
	views, err := services.ListOwnedActingProfiles(ctx, handler.Container, owner, personal, target.String())
	if err != nil {
		return types.ActingProfileView{}, err
	}
	for _, view := range views {
		if view.Id == target.String() {
			return view, handler.saveSelection(ctx, owner, target)
		}
	}
	return types.ActingProfileView{}, usersErrors.ErrActingProfileInvalid
}

func (handler Handler) saveSelection(ctx context.Context, owner, chosen uuid.UUID) error {
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if _, err := tx.ActingProfile.Delete().Where(actingprofile.AccountID(owner)).Exec(ctx); err != nil {
			return err
		}
		return tx.ActingProfile.Create().SetAccountID(owner).SetProfileID(chosen).Exec(ctx)
	})
}
