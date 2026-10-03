package changeadminpermissions

import "zudomart/platform/staffauth"

type Command struct {
	Actor       staffauth.Staff
	TargetId    string
	Permissions []string
}
