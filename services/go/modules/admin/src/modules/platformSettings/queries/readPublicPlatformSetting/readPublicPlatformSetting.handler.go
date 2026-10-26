package readpublicplatformsetting

import (
	"context"

	"nantty/modules/admin/src/container"
	adminerrors "nantty/modules/admin/src/errors"
	"nantty/modules/admin/src/modules/platformSettings/models"
	"nantty/modules/admin/src/modules/platformSettings/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (models.PlatformSettingView, error) {
	if definition, known := services.PlatformSettingDefinitions[query.Key]; !known || !definition.Public {
		return models.PlatformSettingView{}, adminerrors.SettingNotFound
	}
	return services.PlatformSettingsReader{Container: handler.Container}.GetSettingView(ctx, query.Key)
}
