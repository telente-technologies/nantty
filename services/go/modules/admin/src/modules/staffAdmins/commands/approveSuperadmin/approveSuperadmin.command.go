package approvesuperadmin

import "zudomart/platform/staffauth"

type Command struct {
	Actor    staffauth.Staff
	TargetId string
	Reason   string
}
