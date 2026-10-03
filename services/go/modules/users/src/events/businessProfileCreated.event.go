package events

type BusinessProfileCreatedEventData struct {
	AccountId string `json:"accountId"`
	ProfileId string `json:"profileId"`
	Handle    string `json:"handle"`
}
