package models

import (
	"encoding/json"
	"time"

	"zudomart/modules/admin/src/generated/ent"
)

type PlatformSettingView struct {
	Key       string          `json:"key"`
	Value     json.RawMessage `json:"value"`
	Version   int             `json:"version"`
	UpdatedBy string          `json:"updatedBy"`
	UpdatedAt string          `json:"updatedAt"`
}

func ConvertSettingToView(row *ent.PlatformSetting) PlatformSettingView {
	return PlatformSettingView{Key: row.Key, Value: row.Value, Version: row.Version, UpdatedBy: row.UpdatedBy, UpdatedAt: row.UpdatedAt.UTC().Format(time.RFC3339)}
}
