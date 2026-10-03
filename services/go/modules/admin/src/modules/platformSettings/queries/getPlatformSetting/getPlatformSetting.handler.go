package getplatformsetting

import (
	"context"

	"zudomart/modules/admin/src/container"
	"zudomart/modules/admin/src/modules/platformSettings/models"
	"zudomart/modules/admin/src/modules/platformSettings/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (models.PlatformSettingView, error) {
	return services.PlatformSettingsReader{Container: handler.Container}.GetSettingView(ctx, query.Key)
}
