package removereservedusernamerule

import "zudomart/modules/users/src/types"

type Command struct {
	Actor types.StaffActor
	Id    string
}
