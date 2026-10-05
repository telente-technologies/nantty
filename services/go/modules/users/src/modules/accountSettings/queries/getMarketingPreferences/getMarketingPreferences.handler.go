package getmarketingpreferences

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/users/src/container"
	usersErrors "zudomart/modules/users/src/errors"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/privacysetting"
	"zudomart/modules/users/src/modules/accountSettings/models"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (models.MarketingPreferences, error) {
	owner, err := uuid.Parse(query.AccountId)
	if err != nil {
		return models.MarketingPreferences{}, usersErrors.ErrAccountUnavailable
	}
	row, err := handler.Container.Client.PrivacySetting.Query().Where(privacysetting.AccountID(owner)).Only(ctx)
	if ent.IsNotFound(err) {
		return models.MarketingPreferences{Frequency: string(privacysetting.DefaultMarketingFrequency)}, nil
	}
	if err != nil {
		return models.MarketingPreferences{}, err
	}
	return models.MarketingPreferences{Frequency: string(row.MarketingFrequency)}, nil
}
