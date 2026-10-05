package services

import (
	"context"
	"encoding/json"

	"zudomart/modules/admin/src/container"
	adminerrors "zudomart/modules/admin/src/errors"
	"zudomart/modules/admin/src/generated/ent"
	"zudomart/modules/admin/src/generated/ent/platformsetting"
	"zudomart/modules/admin/src/modules/platformSettings/models"
	"zudomart/platform/identityports"
)

type PlatformSettingsReader struct {
	Container *container.Container
}

func (reader PlatformSettingsReader) GetSettingView(ctx context.Context, key string) (models.PlatformSettingView, error) {
	row, err := reader.Container.Client.PlatformSetting.Query().Where(platformsetting.Key(key)).Only(ctx)
	if ent.IsNotFound(err) {
		return models.PlatformSettingView{}, adminerrors.SettingNotFound
	}
	if err != nil {
		return models.PlatformSettingView{}, err
	}
	views, err := BuildSettingViews(ctx, reader.Container.Client, []*ent.PlatformSetting{row})
	if err != nil {
		return models.PlatformSettingView{}, err
	}
	return views[0], nil
}

func (reader PlatformSettingsReader) ReadSettingValue(ctx context.Context, key string) (json.RawMessage, int, error) {
	row, err := reader.Container.Client.PlatformSetting.Query().Where(platformsetting.Key(key)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, 0, identityports.ErrSettingNotFound
	}
	if err != nil {
		return nil, 0, err
	}
	return row.Value, row.Version, nil
}
