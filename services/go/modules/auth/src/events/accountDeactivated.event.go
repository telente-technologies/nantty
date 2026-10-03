package events

type AccountDeactivatedEventData struct {
	AccountId string `json:"accountId"`
}

type AccountEnforcementEventData struct {
	AccountId string `json:"accountId"`
}
