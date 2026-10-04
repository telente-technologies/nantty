package decidestrikeappeal

import "zudomart/platform/staffauth"

type Command struct {
	Staff     staffauth.Staff
	IpAddress string
	RequestId string
	StrikeId  string
	Action    string
	Reason    string
}
