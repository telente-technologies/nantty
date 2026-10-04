package dtos

type StartCaptureRequest struct {
	ConsentVersion  string `json:"consentVersion"`
	ConsentAccepted bool   `json:"consentAccepted"`
	Platform        string `json:"platform"`
	DocumentCountry string `json:"documentCountry"`
	DocumentType    string `json:"documentType"`
}

type DecisionRequest struct {
	Reason string `json:"reason"`
}
