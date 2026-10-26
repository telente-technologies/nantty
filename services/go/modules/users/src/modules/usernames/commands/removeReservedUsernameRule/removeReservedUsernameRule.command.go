package removereservedusernamerule

import "nantty/modules/users/src/types"

type Command struct {
	Actor types.StaffActor
	Id    string
}
