package revokelifetimecheckmark

import "nantty/modules/users/src/types"

type Command struct {
	Actor   types.StaffActor
	GrantId string
	Reason  string
}
