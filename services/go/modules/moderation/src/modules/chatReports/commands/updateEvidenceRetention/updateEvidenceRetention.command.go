package updateevidenceretention

import "zudomart/platform/staffauth"

type Command struct {
	Staff         staffauth.Staff
	IpAddress     string
	RequestId     string
	RetentionDays int
	Reason        string
}
