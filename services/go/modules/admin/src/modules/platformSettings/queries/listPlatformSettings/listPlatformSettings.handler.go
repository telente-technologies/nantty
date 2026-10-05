package listplatformsettings

import (
	"context"

	"zudomart/modules/admin/src/container"
	"zudomart/modules/admin/src/generated/ent"
	"zudomart/modules/admin/src/generated/ent/platformsetting"
	"zudomart/modules/admin/src/modules/platformSettings/models"
	"zudomart/modules/admin/src/modules/platformSettings/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, _ Query) ([]models.PlatformSettingView, error) {
	rows, err := handler.Container.Client.PlatformSetting.Query().Order(ent.Asc(platformsetting.FieldKey)).All(ctx)
	if err != nil {
		return nil, err
	}
	return services.BuildSettingViews(ctx, handler.Container.Client, rows)
}
