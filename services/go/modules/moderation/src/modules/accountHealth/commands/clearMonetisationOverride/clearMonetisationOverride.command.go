package clearmonetisationoverride

import "zudomart/platform/staffauth"

type Command struct {
	Staff     staffauth.Staff
	IpAddress string
	RequestId string
	AccountId string
	Reason    string
}
