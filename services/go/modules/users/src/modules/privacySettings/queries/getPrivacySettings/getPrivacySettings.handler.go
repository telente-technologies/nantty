package getprivacysettings

import (
	"context"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/modules/privacySettings/models"
	"nantty/modules/users/src/modules/privacySettings/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (models.PrivacySettings, error) {
	return services.ReadPrivacySettings(ctx, handler.Container.Client, query.AccountId)
}
