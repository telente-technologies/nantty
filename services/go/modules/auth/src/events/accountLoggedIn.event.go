package events

type UserLoggedInEventData struct {
	AccountId string `json:"accountId"`
	SessionId string `json:"sessionId"`
	Method    string `json:"method"`
}
