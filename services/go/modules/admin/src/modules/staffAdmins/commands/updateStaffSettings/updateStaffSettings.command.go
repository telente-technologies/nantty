package updatestaffsettings

import "nantty/platform/staffauth"

type Command struct {
	Actor                           staffauth.Staff
	RequireSecondSuperadminApproval bool
	Reason                          string
}
