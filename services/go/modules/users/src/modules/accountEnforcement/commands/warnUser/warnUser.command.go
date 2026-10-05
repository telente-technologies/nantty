package warnuser

import "zudomart/modules/users/src/types"

type Command struct {
	Actor    types.StaffActor
	TargetId string
	Reason   string
	Source   string
	CaseId   string
	Policy   string
}
