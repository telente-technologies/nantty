package changeadminpermissions

import "zudomart/platform/staffauth"

type Command struct {
	Actor       staffauth.Staff
	TargetId    string
	Role        string
	RoleIds     []string
	Permissions []string
	Reason      string
}
