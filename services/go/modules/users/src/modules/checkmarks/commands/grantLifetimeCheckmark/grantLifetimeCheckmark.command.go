package grantlifetimecheckmark

import "zudomart/modules/users/src/types"

type Command struct {
	Actor    types.StaffActor
	Username string
	Color    string
	Reason   string
}
