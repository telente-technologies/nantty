package events

type UsernameChangedEventData struct {
	AccountId string `json:"accountId"`
	Username  string `json:"username"`
}

type AccountDeactivatedEventData struct {
	AccountId string `json:"accountId"`
}
