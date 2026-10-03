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
	CodeSealed       string `json:"codeSealed"`
	KeyId            string `json:"keyId"`
	ExpiresAt        string `json:"expiresAt"`
	ExpiresInMinutes int    `json:"expiresInMinutes"`
}
