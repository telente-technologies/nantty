package decidesecuritycase

import "nantty/platform/staffauth"

const (
	ActionClear          = "clear"
	ActionKeepRestricted = "keep_restricted"
	ActionSuspend        = "suspend"
	ActionBan            = "ban"
	ActionDelete         = "delete"
)

type Command struct {
	Staff           staffauth.Staff
	IpAddress       string
	RequestId       string
	CaseId          string
	Action          string
	Reason          string
	DurationDays    *int
	Features        []string
	ConfirmUsername string
}
