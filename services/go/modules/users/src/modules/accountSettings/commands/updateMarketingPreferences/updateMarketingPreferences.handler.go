package updatemarketingpreferences

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/privacysetting"
	"nantty/modules/users/src/modules/accountSettings/models"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (models.MarketingPreferences, error) {
	owner, err := uuid.Parse(command.AccountId)
	if err != nil {
		return models.MarketingPreferences{}, usersErrors.ErrAccountUnavailable
	}
	frequency := privacysetting.MarketingFrequency(command.Frequency)
	if privacysetting.MarketingFrequencyValidator(frequency) != nil {
		return models.MarketingPreferences{}, usersErrors.ValidationFailedFor("frequency", "must be weekly, important_only or off")
	}
	save := func(tx *ent.Tx) error {
		updated, err := tx.PrivacySetting.Update().Where(privacysetting.AccountID(owner)).SetMarketingFrequency(frequency).Save(ctx)
		if err != nil || updated > 0 {
			return err
		}
		return tx.PrivacySetting.Create().SetAccountID(owner).SetMarketingFrequency(frequency).Exec(ctx)
	}
	err = handler.Container.RunInTransaction(ctx, save)
	if ent.IsConstraintError(err) {
		err = handler.Container.RunInTransaction(ctx, save)
	}
	if err != nil {
		return models.MarketingPreferences{}, err
	}
	return models.MarketingPreferences{Frequency: string(frequency)}, nil
}
