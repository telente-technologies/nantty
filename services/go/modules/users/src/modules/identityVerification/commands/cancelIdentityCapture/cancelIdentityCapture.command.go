package cancelidentitycapture

type Command struct {
	AccountId        string
	CaseId           string
	CaptureAttemptID string
}

type Result struct {
	Cancelled bool `json:"cancelled"`
}
