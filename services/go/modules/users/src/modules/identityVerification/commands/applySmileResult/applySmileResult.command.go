package applysmileresult

const (
	OutcomeApproved    = "approved"
	OutcomeUnderReview = "under_review"
	OutcomeReplayed    = "replayed"
	OutcomeIgnored     = "ignored"
)

type Command struct {
	RawBody []byte
}

type Result struct {
	Outcome string `json:"outcome"`
}
