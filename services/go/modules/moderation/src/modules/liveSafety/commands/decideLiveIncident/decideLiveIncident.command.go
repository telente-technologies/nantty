package decideliveincident

import "nantty/platform/staffauth"

const (
	ActionKeepLive      = "keep_live"
	ActionKeepPaused    = "keep_paused"
	ActionEndLive       = "end_live"
	ActionEndAndSuspend = "end_and_suspend"
)

type Command struct {
	Staff        staffauth.Staff
	IpAddress    string
	RequestId    string
	IncidentId   string
	Action       string
	Reason       string
	DurationDays *int
}
