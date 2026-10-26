package createstaffrole

import "nantty/platform/staffauth"

type Command struct {
	Actor       staffauth.Staff
	Name        string
	Permissions []string
	Reason      string
}
