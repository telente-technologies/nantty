package decidecreatorapplication

import "zudomart/modules/users/src/types"

type Command struct {
	Actor         types.StaffActor
	ApplicationId string
	Approve       bool
	Reason        string
}
