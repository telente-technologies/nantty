package restoreautomationrule

import "nantty/platform/staffauth"

type Command struct {
	Staff           staffauth.Staff
	IpAddress       string
	RequestId       string
	RuleId          string
	Version         int
	ExpectedVersion *int
	Reason          string
	Archive         bool
}
