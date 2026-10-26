package listplatformsettings

import (
	"context"

	"nantty/modules/admin/src/container"
	"nantty/modules/admin/src/generated/ent"
	"nantty/modules/admin/src/generated/ent/platformsetting"
	"nantty/modules/admin/src/modules/platformSettings/models"
	"nantty/modules/admin/src/modules/platformSettings/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, _ Query) ([]models.PlatformSettingView, error) {
	rows, err := handler.Container.Client.PlatformSetting.Query().Order(ent.Asc(platformsetting.FieldKey)).All(ctx)
	if err != nil {
		return nil, err
	}
	views, err := services.BuildSettingViews(ctx, handler.Container.Client, rows)
	if err != nil {
		return nil, err
	}
	return services.AddProjectedSettingViews(views)
}
