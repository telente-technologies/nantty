package events

type RefreshTokenReuseDetectedEventData struct {
	AccountId string `json:"accountId"`
	SessionId string `json:"sessionId"`
}
