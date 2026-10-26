package decidecreatorapplication

import "nantty/modules/users/src/types"

type Command struct {
	Actor         types.StaffActor
	ApplicationId string
	Approve       bool
	Reason        string
}
