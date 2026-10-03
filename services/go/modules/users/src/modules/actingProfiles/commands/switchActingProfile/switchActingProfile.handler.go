package switchactingprofile

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/users/src/container"
	usersErrors "zudomart/modules/users/src/errors"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/actingprofile"
	"zudomart/modules/users/src/services"
	"zudomart/modules/users/src/types"
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
	if _, _, err := services.EnsurePersonalProfile(ctx, handler.Container, owner); err != nil {
		return types.ActingProfileView{}, err
	}
	rows, err := services.ListActiveProfilesOfAccount(ctx, handler.Container, owner)
	if err != nil {
		return types.ActingProfileView{}, err
	}
	for _, row := range rows {
		if row.ID == target {
			return handler.saveSelection(ctx, owner, row)
		}
	}
	return types.ActingProfileView{}, usersErrors.ErrActingProfileInvalid
}

func (handler Handler) saveSelection(ctx context.Context, owner uuid.UUID, chosen *ent.Profile) (types.ActingProfileView, error) {
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if _, err := tx.ActingProfile.Delete().Where(actingprofile.AccountID(owner)).Exec(ctx); err != nil {
			return err
		}
		return tx.ActingProfile.Create().SetAccountID(owner).SetProfileID(chosen.ID).Exec(ctx)
	})
	return types.BuildActingProfileView(chosen, chosen.ID.String()), err
}
