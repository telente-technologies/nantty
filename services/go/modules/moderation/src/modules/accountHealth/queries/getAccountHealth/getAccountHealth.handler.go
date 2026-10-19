package getaccounthealth

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/modules/accountHealth/services"
	"zudomart/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, accountId string, includeStaffDetails bool) (services.AccountHealthView, error) {
	identifier, err := uuid.Parse(accountId)
	if err != nil {
		return services.AccountHealthView{}, httpserver.ErrNotFound
	}
	return services.BuildAccountHealth(ctx, handler.Container.Client, identifier, handler.Container.Now(), includeStaffDetails)
}
