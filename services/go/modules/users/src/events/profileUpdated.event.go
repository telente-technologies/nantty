package events

type ProfileUpdatedEventData struct {
	AccountId     string   `json:"accountId"`
	ProfileId     string   `json:"profileId"`
	ChangedFields []string `json:"changedFields"`
}

type ProfileVisibilityChangedEventData struct {
	AccountId string `json:"accountId"`
	ProfileId string `json:"profileId"`
	IsPrivate bool   `json:"isPrivate"`
}
