package getplatformsetting

import (
	"context"

	"nantty/modules/admin/src/container"
	"nantty/modules/admin/src/modules/platformSettings/models"
	"nantty/modules/admin/src/modules/platformSettings/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (models.PlatformSettingView, error) {
	return services.PlatformSettingsReader{Container: handler.Container}.GetSettingView(ctx, query.Key)
}
