package dtos

type ActionRequest struct {
	Action string `json:"action"`
	Reason string `json:"reason"`
}

type SuspendAuthorRequest struct {
	DurationDays int    `json:"durationDays"`
	Reason       string `json:"reason"`
}
