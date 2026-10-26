package setmonetisationoverride

import "nantty/platform/staffauth"

type Command struct {
	Staff     staffauth.Staff
	IpAddress string
	RequestId string
	AccountId string
	Mode      string
	Reason    string
}
