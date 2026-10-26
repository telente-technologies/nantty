package updateevidenceretention

import "nantty/platform/staffauth"

type Command struct {
	Staff         staffauth.Staff
	IpAddress     string
	RequestId     string
	RetentionDays int
	Reason        string
}
