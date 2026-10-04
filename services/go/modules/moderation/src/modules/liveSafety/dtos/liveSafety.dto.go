package dtos

type IncidentActionRequest struct {
	Action string `json:"action"`
	Reason string `json:"reason"`
}

type EndAndSuspendRequest struct {
	Reason       string `json:"reason"`
	DurationDays int    `json:"durationDays"`
}

type AppealRequest struct {
	Message string `json:"message"`
}
