package dtos

type StartCaptureRequest struct {
	ConsentVersion      string `json:"consentVersion"`
	ConsentAccepted     bool   `json:"consentAccepted"`
	Platform            string `json:"platform"`
	VerificationMethod  string `json:"verificationMethod"`
	VerificationProduct string `json:"verificationProduct"`
	DocumentCountry     string `json:"documentCountry"`
	DocumentType        string `json:"documentType"`
}

type CancelCaptureRequest struct {
	CaptureAttemptID string `json:"captureAttemptId"`
}

type ReplayCallbackRequest struct {
	JobID  string `json:"jobId"`
	Reason string `json:"reason"`
}

type DecisionRequest struct {
	Reason string `json:"reason"`
}
