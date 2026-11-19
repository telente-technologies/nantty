package startidentitycapture

type Command struct {
	AccountId           string
	CaseId              string
	ConsentVersion      string
	ConsentAccepted     bool
	Platform            string
	VerificationMethod  string
	VerificationProduct string
	DocumentCountry     string
	DocumentType        string
}

type Result struct {
	Mode             string `json:"mode"`
	CaptureAttemptID string `json:"captureAttemptId"`
	Token            string `json:"token,omitempty"`
	Url              string `json:"url,omitempty"`
	Product          string `json:"product"`
	CaseId           string `json:"caseId"`
	PartnerId        string `json:"partnerId"`
	Environment      string `json:"environment"`
	CallbackUrl      string `json:"callbackUrl"`
}
