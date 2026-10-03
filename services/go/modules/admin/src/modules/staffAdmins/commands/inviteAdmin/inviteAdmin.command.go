package inviteadmin

import "zudomart/platform/staffauth"

type Command struct {
	Actor       staffauth.Staff
	Email       string
	DisplayName string
	Permissions []string
}
