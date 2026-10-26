package clearmonetisationoverride

import "nantty/platform/staffauth"

type Command struct {
	Staff     staffauth.Staff
	IpAddress string
	RequestId string
	AccountId string
	Reason    string
}
