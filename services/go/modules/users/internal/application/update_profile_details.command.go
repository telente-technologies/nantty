package application

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/users/internal/ent"
)

type OptionalText struct {
	Present bool
	Value   *string
}

type UpdateProfileInput struct {
	AccountId     string
	Name          *string
	Bio           *string
	Website       OptionalText
	AvatarUrl     OptionalText
	BannerUrl     OptionalText
	AvatarMediaId *string
	BannerMediaId *string
	IsPrivate     *bool
}

func (application *UsersApplication) UpdateMyProfileDetails(ctx context.Context, input UpdateProfileInput) (UserView, error) {
	owner, err := uuid.Parse(input.AccountId)
	if err != nil {
		return UserView{}, errAccountUnavailable
	}
	row, summary, err := application.ensurePersonalProfile(ctx, owner)
	if err != nil {
		return UserView{}, err
	}
	var changed []string
	var visibilityChanged bool
	err = application.runInTransaction(ctx, func(tx *ent.Tx) error {
		update := tx.Profile.UpdateOneID(row.ID)
		if changed, err = application.applyProfileFieldChanges(update, input, row); err != nil {
			return err
		}
		visibilityChanged = input.IsPrivate != nil && *input.IsPrivate != row.IsPrivate
		if len(changed) == 0 {
			return nil
		}
		if row, err = update.Save(ctx); err != nil {
			return err
		}
		return application.enqueueProfileChangeEvents(ctx, tx, row, changed, visibilityChanged)
	})
	if err != nil {
		return UserView{}, err
	}
	isCreator, err := application.hasActiveCreatorProfile(ctx, owner)
	return application.buildUserView(row, summary, isCreator, true), err
}

func (application *UsersApplication) applyProfileFieldChanges(update *ent.ProfileUpdateOne, input UpdateProfileInput, current *ent.Profile) ([]string, error) {
	var changed []string
	if input.Name != nil {
		name := strings.TrimSpace(*input.Name)
		if len([]rune(name)) > 80 {
			return nil, unprocessable("Names can be at most 80 characters.")
		}
		update.SetDisplayName(name)
		changed = append(changed, "name")
	}
	if input.Bio != nil {
		if len([]rune(*input.Bio)) > 300 {
			return nil, unprocessable("Bios can be at most 300 characters.")
		}
		update.SetBio(strings.TrimSpace(*input.Bio))
		changed = append(changed, "bio")
	}
	if input.IsPrivate != nil {
		update.SetIsPrivate(*input.IsPrivate)
		changed = append(changed, "isPrivate")
	}
	if input.Website.Present {
		if input.Website.Value != nil {
			if err := application.assertImageUrlIsAllowed(*input.Website.Value); err != nil {
				return nil, unprocessable("Enter a valid website link.")
			}
			update.SetWebsite(*input.Website.Value)
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
		{"avatar", input.AvatarUrl, input.AvatarMediaId, update.SetAvatarMediaKey, update.SetAvatarURL, func() *ent.ProfileUpdateOne { return update.ClearAvatarMediaKey().ClearAvatarURL() }},
		{"banner", input.BannerUrl, input.BannerMediaId, update.SetBannerMediaKey, update.SetBannerURL, func() *ent.ProfileUpdateOne { return update.ClearBannerMediaKey().ClearBannerURL() }},
	} {
		imageChanged, err := application.applyImageChange(input.AccountId, image.purpose, image.url, image.mediaId, image.setMedia, image.setUrl, image.clear)
		if err != nil {
			return nil, err
		}
		if imageChanged {
			changed = append(changed, image.purpose)
		}
	}
	return changed, nil
}

func (application *UsersApplication) applyImageChange(accountId, purpose string, rawUrl OptionalText, mediaId *string, setMedia, setUrl func(string) *ent.ProfileUpdateOne, clear func() *ent.ProfileUpdateOne) (bool, error) {
	switch {
	case mediaId != nil:
		if !strings.HasPrefix(*mediaId, mediaKeyPrefixFor(accountId, purpose)) || strings.Contains(*mediaId, "..") || len(*mediaId) > 200 {
			return false, unprocessable("That upload does not belong to your account.")
		}
		setMedia(*mediaId)
		setUrl(application.publicUrlForMediaKey(*mediaId))
	case rawUrl.Present && rawUrl.Value == nil:
		clear()
	case rawUrl.Present:
		if err := application.assertImageUrlIsAllowed(*rawUrl.Value); err != nil {
			return false, err
		}
		setUrl(*rawUrl.Value)
	default:
		return false, nil
	}
	return true, nil
}

func (application *UsersApplication) enqueueProfileChangeEvents(ctx context.Context, tx *ent.Tx, row *ent.Profile, changed []string, visibilityChanged bool) error {
	now := application.Now()
	if err := enqueueOutboxEventInTransaction(ctx, tx, "profile.updated", row.AccountID.String(), now, ProfileUpdatedEventData{
		AccountId: row.AccountID.String(), ProfileId: row.ID.String(), ChangedFields: changed,
	}); err != nil || !visibilityChanged {
		return err
	}
	return enqueueOutboxEventInTransaction(ctx, tx, "profile.visibilityChanged", row.AccountID.String(), now, ProfileVisibilityChangedEventData{
		AccountId: row.AccountID.String(), ProfileId: row.ID.String(), IsPrivate: row.IsPrivate,
	})
}
