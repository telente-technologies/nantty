package applyforcreator

import (
	"context"
	"encoding/json"
	"fmt"
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

func (handler Handler) Execute(ctx context.Context, command Command) (types.UserView, error) {
	owner, err := uuid.Parse(command.AccountId)
	if err != nil {
		return types.UserView{}, usersErrors.ErrAccountUnavailable
	}
	personal, summary, err := services.EnsurePersonalProfile(ctx, handler.Container, owner)
	if err != nil {
		return types.UserView{}, err
	}
	if personal.CreatorStatus == profile.CreatorStatusPending || personal.CreatorStatus == profile.CreatorStatusApproved {
		return types.UserView{}, usersErrors.ErrCreatorApplicationExists
	}
	if err := handler.assertAccountIsOldEnough(ctx, summary.CreatedAt); err != nil {
		return types.UserView{}, err
	}
	var updated *ent.Profile
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		var err error
		if updated, err = tx.Profile.UpdateOne(personal).SetCreatorStatus(profile.CreatorStatusPending).Save(ctx); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "creatorApplication.submitted", owner.String(), handler.Container.Now(), events.CreatorApplicationSubmittedEventData{
			AccountId: owner.String(), ProfileId: updated.ID.String(),
		})
	})
	if err != nil {
		return types.UserView{}, err
	}
	return types.BuildUserView(updated, summary, true), nil
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
