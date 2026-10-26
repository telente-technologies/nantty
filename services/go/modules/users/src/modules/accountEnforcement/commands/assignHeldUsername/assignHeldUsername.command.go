package assignheldusername

import "nantty/modules/users/src/types"

type Command struct {
	Actor      types.StaffActor
	TargetId   string
	Username   string
	Reason     string
	BypassHold bool
}
