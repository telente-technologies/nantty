package updatebusinessprofile

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/events"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/profile"
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
		return types.ActingProfileView{}, usersErrors.ErrProfileNotFound
	}
	existing, err := handler.Container.Client.Profile.Query().Where(profile.ID(target), profile.AccountID(owner), profile.KindEQ(profile.KindBusiness), profile.StatusEQ(profile.StatusActive)).Only(ctx)
	if ent.IsNotFound(err) {
		return types.ActingProfileView{}, usersErrors.ErrProfileNotFound
	}
	if err != nil {
		return types.ActingProfileView{}, err
	}
	mutations, changed, err := handler.buildMutations(command)
	if err != nil {
		return types.ActingProfileView{}, err
	}
	if len(changed) > 0 {
		err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
			update := tx.Profile.UpdateOneID(existing.ID)
			for _, mutate := range mutations {
				mutate(update)
			}
			if err := update.Exec(ctx); err != nil {
				return err
			}
			return events.EnqueueOutboxEventInTransaction(ctx, tx, "profile.updated", owner.String(), handler.Container.Now(), events.ProfileUpdatedEventData{
				AccountId: owner.String(), ProfileId: existing.ID.String(), ChangedFields: changed,
			})
		})
		if err != nil {
			return types.ActingProfileView{}, err
		}
	}
	updated, err := handler.Container.Client.Profile.Query().Where(profile.ID(existing.ID)).WithCategories().Only(ctx)
	if err != nil {
		return types.ActingProfileView{}, err
	}
	return services.BuildLinkedActingProfileView(ctx, handler.Container, updated, "")
}

func (handler Handler) buildMutations(command Command) ([]func(*ent.ProfileUpdateOne), []string, error) {
	var mutations []func(*ent.ProfileUpdateOne)
	var changed []string
	if command.DisplayName != nil {
		name := strings.TrimSpace(*command.DisplayName)
		if len([]rune(name)) < 2 || len([]rune(name)) > 80 {
			return nil, nil, usersErrors.Unprocessable("Business names are 2-80 characters.")
		}
		mutations, changed = append(mutations, func(update *ent.ProfileUpdateOne) { update.SetDisplayName(name) }), append(changed, "name")
	}
	if command.Description != nil {
		if len([]rune(*command.Description)) > 300 {
			return nil, nil, usersErrors.Unprocessable("Descriptions can be at most 300 characters.")
		}
		description := strings.TrimSpace(*command.Description)
		mutations, changed = append(mutations, func(update *ent.ProfileUpdateOne) { update.SetBio(description) }), append(changed, "bio")
	}
	if command.Website != nil {
		if err := services.AssertImageUrlIsAllowed(handler.Container, *command.Website); err != nil {
			return nil, nil, usersErrors.Unprocessable("Enter a valid website link.")
		}
		website := *command.Website
		mutations, changed = append(mutations, func(update *ent.ProfileUpdateOne) { update.SetWebsite(website) }), append(changed, "website")
	} else if command.ClearSite {
		mutations, changed = append(mutations, func(update *ent.ProfileUpdateOne) { update.ClearWebsite() }), append(changed, "website")
	}
	if command.IsPrivate != nil {
		isPrivate := *command.IsPrivate
		mutations, changed = append(mutations, func(update *ent.ProfileUpdateOne) { update.SetIsPrivate(isPrivate) }), append(changed, "isPrivate")
	}
	return mutations, changed, nil
}
