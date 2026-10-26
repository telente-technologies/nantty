package updateprofiledetails

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/events"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/services"
	"nantty/modules/users/src/types"
)

type Handler struct {
	*container.Container
}

func (application Handler) Execute(ctx context.Context, command Command) (types.UserView, error) {
	owner, err := uuid.Parse(command.AccountId)
	if err != nil {
		return types.UserView{}, usersErrors.ErrAccountUnavailable
	}
	row, summary, err := services.EnsurePersonalProfile(ctx, application.Container, owner)
	if err != nil {
		return types.UserView{}, err
	}
	var changed []string
	var visibilityChanged bool
	err = application.RunInTransaction(ctx, func(tx *ent.Tx) error {
		update := tx.Profile.UpdateOneID(row.ID)
		if changed, err = application.applyProfileFieldChanges(update, command, row); err != nil {
			return err
		}
		visibilityChanged = command.IsPrivate != nil && *command.IsPrivate != row.IsPrivate
		if len(changed) == 0 {
			return nil
		}
		if row, err = update.Save(ctx); err != nil {
			return err
		}
		return application.enqueueProfileChangeEvents(ctx, tx, row, changed, visibilityChanged)
	})
	if err != nil {
		return types.UserView{}, err
	}
	return types.BuildUserView(row, summary, true), err
}

func (application Handler) applyProfileFieldChanges(update *ent.ProfileUpdateOne, command Command, current *ent.Profile) ([]string, error) {
	var changed []string
	if command.Name != nil {
		name := strings.TrimSpace(*command.Name)
		if len([]rune(name)) > 80 {
			return nil, usersErrors.Unprocessable("Names can be at most 80 characters.")
		}
		update.SetDisplayName(name)
		changed = append(changed, "name")
	}
	if command.Bio != nil {
		if len([]rune(*command.Bio)) > 300 {
			return nil, usersErrors.Unprocessable("Bios can be at most 300 characters.")
		}
		update.SetBio(strings.TrimSpace(*command.Bio))
		changed = append(changed, "bio")
	}
	if command.IsPrivate != nil {
		update.SetIsPrivate(*command.IsPrivate)
		changed = append(changed, "isPrivate")
	}
	if command.Website.Present {
		if command.Website.Value != nil {
			if err := services.AssertImageUrlIsAllowed(application.Container, *command.Website.Value); err != nil {
				return nil, usersErrors.Unprocessable("Enter a valid website link.")
			}
			update.SetWebsite(*command.Website.Value)
		} else {
			update.ClearWebsite()
		}
		changed = append(changed, "website")
	}
	for _, image := range []struct {
		purpose  string
		url      OptionalText
		mediaId  *string
		setMedia func(string) *ent.ProfileUpdateOne
		setUrl   func(string) *ent.ProfileUpdateOne
		clear    func() *ent.ProfileUpdateOne
	}{
		{"avatar", command.AvatarUrl, command.AvatarMediaId, update.SetAvatarMediaKey, update.SetAvatarURL, func() *ent.ProfileUpdateOne { return update.ClearAvatarMediaKey().ClearAvatarURL() }},
		{"banner", command.BannerUrl, command.BannerMediaId, update.SetBannerMediaKey, update.SetBannerURL, func() *ent.ProfileUpdateOne { return update.ClearBannerMediaKey().ClearBannerURL() }},
	} {
		imageChanged, err := application.applyImageChange(command.AccountId, image.purpose, image.url, image.mediaId, image.setMedia, image.setUrl, image.clear)
		if err != nil {
			return nil, err
		}
		if imageChanged {
			changed = append(changed, image.purpose)
		}
	}
	return changed, nil
}

func (application Handler) applyImageChange(accountId, purpose string, rawUrl OptionalText, mediaId *string, setMedia, setUrl func(string) *ent.ProfileUpdateOne, clear func() *ent.ProfileUpdateOne) (bool, error) {
	switch {
	case mediaId != nil:
		if !strings.HasPrefix(*mediaId, services.MediaKeyPrefixFor(accountId, purpose)) || strings.Contains(*mediaId, "..") || len(*mediaId) > 200 {
			return false, usersErrors.Unprocessable("That upload does not belong to your account.")
		}
		setMedia(*mediaId)
		setUrl(services.PublicUrlForMediaKey(application.Container, *mediaId))
	case rawUrl.Present && rawUrl.Value == nil:
		clear()
	case rawUrl.Present:
		if err := services.AssertImageUrlIsAllowed(application.Container, *rawUrl.Value); err != nil {
			return false, err
		}
		setUrl(*rawUrl.Value)
	default:
		return false, nil
	}
	return true, nil
}

func (application Handler) enqueueProfileChangeEvents(ctx context.Context, tx *ent.Tx, row *ent.Profile, changed []string, visibilityChanged bool) error {
	now := application.Now()
	if err := events.EnqueueOutboxEventInTransaction(ctx, tx, "profile.updated", row.AccountID.String(), now, events.ProfileUpdatedEventData{
		AccountId: row.AccountID.String(), ProfileId: row.ID.String(), ChangedFields: changed,
	}); err != nil || !visibilityChanged {
		return err
	}
	return events.EnqueueOutboxEventInTransaction(ctx, tx, "profile.visibilityChanged", row.AccountID.String(), now, events.ProfileVisibilityChangedEventData{
		AccountId: row.AccountID.String(), ProfileId: row.ID.String(), IsPrivate: row.IsPrivate,
	})
}
