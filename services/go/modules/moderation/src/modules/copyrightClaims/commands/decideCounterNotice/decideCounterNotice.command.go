package decidecounternotice

import "zudomart/platform/staffauth"

type Command struct {
	Staff     staffauth.Staff
	IpAddress string
	RequestId string
	ClaimId   string
	NoticeId  string
	Action    string
	Reason    string
}
