package decideipclaim

import "nantty/platform/staffauth"

type Command struct {
	Staff     staffauth.Staff
	IpAddress string
	RequestId string
	ClaimId   string
	Action    string
	Reason    string
	AddStrike bool
}

type Result struct {
	StrikeAdded bool
}
