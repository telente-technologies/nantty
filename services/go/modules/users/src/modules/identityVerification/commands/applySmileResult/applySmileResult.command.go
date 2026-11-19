package applysmileresult

const (
	OutcomeApproved    = "approved"
	OutcomeUnderReview = "under_review"
	OutcomeReplayed    = "replayed"
	OutcomeIgnored     = "ignored"
	OutcomeRetryable   = "retryable"
)

type Command struct {
	RawBody   []byte
	Signature string
	Timestamp string
	JobId     string
	UserId    string
}

type Result struct {
	Outcome string `json:"outcome"`
}
