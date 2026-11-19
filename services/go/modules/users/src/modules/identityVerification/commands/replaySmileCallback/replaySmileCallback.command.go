package replaysmilecallback

import "nantty/modules/users/src/types"

type Command struct {
	Actor  types.StaffActor
	CaseID string
	JobID  string
	Reason string
}

type Result struct {
	Accepted bool   `json:"accepted"`
	Message  string `json:"message"`
}
