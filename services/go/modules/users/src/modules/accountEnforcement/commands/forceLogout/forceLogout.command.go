package forcelogout

import "zudomart/modules/users/src/types"

type Command struct {
	Actor     types.StaffActor
	TargetId  string
	Reason    string
	SessionId string
}
