package createcreatorprofile

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/users/src/container"
	usersErrors "zudomart/modules/users/src/errors"
	"zudomart/modules/users/src/events"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/profile"
	"zudomart/modules/users/src/services"
	"zudomart/modules/users/src/types"
	"zudomart/platform/identityports"
)

const settingKeyCreatorRequirements = "creator.requirements"

type creatorRequirements struct {
	MinimumAccountAgeDays int `json:"minimumAccountAgeDays"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (types.ActingProfileView, error) {
	owner, err := uuid.Parse(command.AccountId)
	if err != nil {
		return types.ActingProfileView{}, usersErrors.ErrAccountUnavailable
	}
	personal, summary, err := services.EnsurePersonalProfile(ctx, handler.Container, owner)
	if err != nil {
		return types.ActingProfileView{}, err
	}
	if exists, err := handler.Container.Client.Profile.Query().Where(profile.AccountID(owner), profile.KindEQ(profile.KindCreator)).Exist(ctx); err != nil || exists {
		return types.ActingProfileView{}, services.OrError(err, usersErrors.ErrAlreadyHasCreator)
	}
	if err := handler.assertAccountIsOldEnough(ctx, summary.CreatedAt); err != nil {
		return types.ActingProfileView{}, err
	}
	handle, err := handler.chooseHandle(ctx, owner, personal.Handle, command.Handle)
	if err != nil {
		return types.ActingProfileView{}, err
	}
	var created *ent.Profile
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		builder := tx.Profile.Create().SetAccountID(owner).SetKind(profile.KindCreator).SetHandle(handle).SetDisplayName(personal.DisplayName)
		if command.DisplayName != nil {
			builder.SetDisplayName(strings.TrimSpace(*command.DisplayName))
		}
		if command.Bio != nil && len([]rune(*command.Bio)) <= 300 {
			builder.SetBio(strings.TrimSpace(*command.Bio))
		}
		var err error
		if created, err = builder.Save(ctx); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "creatorProfile.created", owner.String(), handler.Container.Now(), events.CreatorProfileCreatedEventData{
			AccountId: owner.String(), ProfileId: created.ID.String(), Handle: handle,
		})
	})
	if ent.IsConstraintError(err) {
		if strings.Contains(err.Error(), "handle") {
			return types.ActingProfileView{}, usersErrors.ErrHandleTaken
		}
		return types.ActingProfileView{}, usersErrors.ErrAlreadyHasCreator
	}
	if err != nil {
		return types.ActingProfileView{}, err
	}
	return types.BuildActingProfileView(created, ""), nil
}

func (handler Handler) assertAccountIsOldEnough(ctx context.Context, accountCreatedAt time.Time) error {
	settings, err := identityports.Default.PlatformSettings()
	if err != nil {
		return nil
	}
	raw, _, err := settings.ReadSettingValue(ctx, settingKeyCreatorRequirements)
	if err != nil {
		return nil
	}
	var requirements creatorRequirements
	if err := json.Unmarshal(raw, &requirements); err != nil {
		return err
	}
	ageDays := int(handler.Container.Now().Sub(accountCreatedAt).Hours() / 24)
	if ageDays < requirements.MinimumAccountAgeDays {
		return usersErrors.UnprocessableWithCode("CREATOR_REQUIREMENTS_NOT_MET", fmt.Sprintf("Your account must be at least %d days old to become a creator.", requirements.MinimumAccountAgeDays))
	}
	return nil
}

func (handler Handler) chooseHandle(ctx context.Context, owner uuid.UUID, personalHandle string, requested *string) (string, error) {
	candidate := personalHandle + "_creator"
	if requested != nil {
		candidate = *requested
	}
	handle, verdict, err := services.JudgeUsername(ctx, handler.Container, candidate, owner, true)
	if err != nil {
		return "", err
	}
	if !verdict.Available {
		return "", usersErrors.ErrHandleTaken
	}
	return handle, nil
}
