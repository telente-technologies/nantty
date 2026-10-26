package getmysettings

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/modules/accountSettings/models"
	"nantty/modules/users/src/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (models.AccountSettings, error) {
	owner, err := uuid.Parse(query.AccountId)
	if err != nil {
		return models.AccountSettings{}, usersErrors.ErrAccountUnavailable
	}
	row, summary, err := services.EnsurePersonalProfile(ctx, handler.Container, owner)
	if err != nil {
		return models.AccountSettings{}, err
	}
	settings := models.AccountSettings{
		Theme: string(row.Theme), Language: string(row.Language), CountryCode: row.CountryCode, PushNotificationsEnabled: row.PushNotificationsEnabled,
	}
	if summary.Email != nil {
		settings.Email = *summary.Email
	}
	return settings, nil
}
