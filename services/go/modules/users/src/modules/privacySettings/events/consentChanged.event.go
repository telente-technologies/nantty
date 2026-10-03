package events

const (
	ConsentGrantedType   = "consent.granted"
	ConsentWithdrawnType = "consent.withdrawn"
)

type ConsentChangedData struct {
	AccountId     string `json:"accountId"`
	ConsentType   string `json:"consentType"`
	PolicyVersion string `json:"policyVersion"`
	OccurredAt    string `json:"occurredAt"`
}
