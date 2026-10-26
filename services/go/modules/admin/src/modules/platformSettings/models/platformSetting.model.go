package models

import (
	"encoding/json"
	"time"

	"nantty/modules/admin/src/generated/ent"
)

type VersionAuthor struct {
	Id   string `json:"id"`
	Name string `json:"name"`
}

type PlatformSettingView struct {
	Key          string          `json:"key"`
	Value        json.RawMessage `json:"value"`
	Version      int             `json:"version"`
	UpdatedBy    VersionAuthor   `json:"updatedBy"`
	UpdatedAt    string          `json:"updatedAt"`
	ChangeReason string          `json:"changeReason"`
	IsArchived   bool            `json:"isArchived"`
	Id           string          `json:"id"`
	Content      json.RawMessage `json:"content"`
}

func ConvertSettingToView(row *ent.PlatformSetting, author VersionAuthor, changeReason string) PlatformSettingView {
	return PlatformSettingView{
		Key: row.Key, Value: row.Value, Version: row.Version, UpdatedBy: author, UpdatedAt: row.UpdatedAt.UTC().Format(time.RFC3339),
		ChangeReason: changeReason, Id: row.Key, Content: row.Value,
	}
}

func ConvertRevisionToView(row *ent.PlatformSettingRevision, author VersionAuthor) PlatformSettingView {
	return PlatformSettingView{
		Key: row.Key, Value: row.Value, Version: row.Version, UpdatedBy: author, UpdatedAt: row.CreatedAt.UTC().Format(time.RFC3339),
		ChangeReason: row.Reason, Id: row.Key, Content: row.Value,
	}
}
