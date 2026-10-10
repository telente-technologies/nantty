package services

import (
	"encoding/json"
	"slices"
	"strings"

	"zudomart/modules/admin/src/modules/platformSettings/models"
)

type SettingProjection struct {
	SourceKey string
	Project   func(source json.RawMessage) (json.RawMessage, error)
	Merge     func(source, value json.RawMessage) (json.RawMessage, error)
}

func StorageKeyFor(key string) string {
	if projection := PlatformSettingDefinitions[key].Projection; projection != nil {
		return projection.SourceKey
	}
	return key
}

func ProjectSettingView(key string, view models.PlatformSettingView) (models.PlatformSettingView, error) {
	projection := PlatformSettingDefinitions[key].Projection
	if projection == nil {
		return view, nil
	}
	projected, err := projection.Project(view.Value)
	if err != nil {
		return models.PlatformSettingView{}, err
	}
	view.Key, view.Id, view.Value, view.Content = key, key, projected, projected
	return view, nil
}

func ProjectSettingViews(key string, views []models.PlatformSettingView) ([]models.PlatformSettingView, error) {
	for index, view := range views {
		projected, err := ProjectSettingView(key, view)
		if err != nil {
			return nil, err
		}
		views[index] = projected
	}
	return views, nil
}

func AddProjectedSettingViews(views []models.PlatformSettingView) ([]models.PlatformSettingView, error) {
	stored := make([]models.PlatformSettingView, 0, len(views))
	byKey := map[string]models.PlatformSettingView{}
	for _, view := range views {
		if PlatformSettingDefinitions[view.Key].Projection == nil {
			stored = append(stored, view)
			byKey[view.Key] = view
		}
	}
	for key, definition := range PlatformSettingDefinitions {
		source, found := byKey[StorageKeyFor(key)]
		if definition.Projection == nil || !found {
			continue
		}
		projected, err := ProjectSettingView(key, source)
		if err != nil {
			return nil, err
		}
		stored = append(stored, projected)
	}
	slices.SortFunc(stored, func(left, right models.PlatformSettingView) int { return strings.Compare(left.Key, right.Key) })
	return stored, nil
}
