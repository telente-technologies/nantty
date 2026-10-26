package changeadminipallowlist

import "nantty/platform/staffauth"

type Command struct {
	Actor       staffauth.Staff
	TargetId    string
	IpAllowList []string
	Reason      string
}
