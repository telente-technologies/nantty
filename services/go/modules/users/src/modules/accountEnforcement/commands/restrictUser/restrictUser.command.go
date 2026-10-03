package restrictuser

import "zudomart/modules/users/src/types"

type Command struct {
	Actor        types.StaffActor
	TargetId     string
	Features     []string
	DurationDays int
	Reason       string
}
