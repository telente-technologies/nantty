package events

type PasswordChangedEventData struct {
	AccountId       string `json:"accountId"`
	SessionsRevoked int    `json:"sessionsRevoked"`
	Method          string `json:"method"`
}
