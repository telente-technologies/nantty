package events

type SessionRevokedEventData struct {
	AccountId string `json:"accountId"`
	SessionId string `json:"sessionId"`
	Reason    string `json:"reason"`
}
