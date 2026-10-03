package decidecopyrightclaim

import "zudomart/platform/staffauth"

type Command struct {
	Staff     staffauth.Staff
	IpAddress string
	RequestId string
	ClaimId   string
	Action    string
	Reason    string
}
