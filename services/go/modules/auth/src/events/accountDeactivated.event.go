package events

type AccountDeactivatedEventData struct {
	AccountId string `json:"accountId"`
}

type AccountEnforcementEventData struct {
	AccountId string `json:"accountId"`
	Status    string `json:"status"`
}

type OtpIssuedEventData struct {
	Destination      string `json:"destination"`
	Purpose          string `json:"purpose"`
	Code             string `json:"code"`
	ExpiresInMinutes int    `json:"expiresInMinutes"`
}
