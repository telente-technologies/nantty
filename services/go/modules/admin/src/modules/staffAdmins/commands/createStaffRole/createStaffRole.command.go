package createstaffrole

import "zudomart/platform/staffauth"

type Command struct {
	Actor       staffauth.Staff
	Name        string
	Permissions []string
	Reason      string
}
