package banuser

import "zudomart/modules/users/src/types"

type Command struct {
	Actor        types.StaffActor
	TargetId     string
	DurationDays *int
	Reason       string
}
