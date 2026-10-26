package decideappeal

import "nantty/platform/staffauth"

type Command struct {
	Staff     staffauth.Staff
	IpAddress string
	RequestId string
	AppealId  string
	Outcome   string
	Reason    string
}
