package events

type UsernameChangedEventData struct {
	AccountId        string `json:"accountId"`
	ProfileId        string `json:"profileId"`
	PreviousUsername string `json:"previousUsername"`
	Username         string `json:"username"`
}
