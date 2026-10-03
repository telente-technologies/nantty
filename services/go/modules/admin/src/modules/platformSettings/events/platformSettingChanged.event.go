package events

type PlatformSettingChangedEventData struct {
	Key       string `json:"key"`
	Version   int    `json:"version"`
	ChangedBy string `json:"changedBy"`
}
