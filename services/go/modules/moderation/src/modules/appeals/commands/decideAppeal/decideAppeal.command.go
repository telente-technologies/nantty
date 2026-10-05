package decideappeal

import "zudomart/platform/staffauth"

type Command struct {
	Staff     staffauth.Staff
	IpAddress string
	RequestId string
	AppealId  string
	Outcome   string
	Reason    string
}
