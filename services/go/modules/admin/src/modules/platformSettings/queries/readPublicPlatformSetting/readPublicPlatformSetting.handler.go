package readpublicplatformsetting

import (
	"context"

	"zudomart/modules/admin/src/container"
	adminerrors "zudomart/modules/admin/src/errors"
	"zudomart/modules/admin/src/modules/platformSettings/models"
	"zudomart/modules/admin/src/modules/platformSettings/services"
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
