package listplatformsettings

import (
	"context"

	"zudomart/modules/admin/src/container"
	"zudomart/modules/admin/src/generated/ent"
	"zudomart/modules/admin/src/generated/ent/platformsetting"
	"zudomart/modules/admin/src/modules/platformSettings/models"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, _ Query) ([]models.PlatformSettingView, error) {
	rows, err := handler.Container.Client.PlatformSetting.Query().Order(ent.Asc(platformsetting.FieldKey)).All(ctx)
	if err != nil {
		return nil, err
	}
	views := make([]models.PlatformSettingView, 0, len(rows))
	for _, row := range rows {
		views = append(views, models.ConvertSettingToView(row))
	}
	return views, nil
}
