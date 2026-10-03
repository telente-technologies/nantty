package application

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

type UsernameChangedEventData struct {
	AccountId        string `json:"accountId"`
	ProfileId        string `json:"profileId"`
	PreviousUsername string `json:"previousUsername"`
	Username         string `json:"username"`
}

type UsernameWithheldEventData struct {
	Username string `json:"username"`
	Reason   string `json:"reason"`
}

type BusinessProfileCreatedEventData struct {
	AccountId string `json:"accountId"`
	ProfileId string `json:"profileId"`
	Handle    string `json:"handle"`
}

type CreatorProfileCreatedEventData struct {
	AccountId string `json:"accountId"`
	ProfileId string `json:"profileId"`
	Handle    string `json:"handle"`
}
