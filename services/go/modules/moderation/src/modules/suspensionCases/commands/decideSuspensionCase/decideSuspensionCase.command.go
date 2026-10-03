package decidesuspensioncase

import "zudomart/platform/staffauth"

type Command struct {
	Staff      staffauth.Staff
	IpAddress  string
	RequestId  string
	CaseId     string
	Action     string
	ReasonCode string
	Reason     string
}
