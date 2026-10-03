package events

type AccountRegisteredEventData struct {
	AccountId string `json:"accountId"`
	Username  string `json:"username"`
	Name      string `json:"name"`
	Email     string `json:"email"`
	Method    string `json:"method"`
}
