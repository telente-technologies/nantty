package rollbacklegaldocument

import "nantty/modules/users/src/types"

type Command struct {
	Actor         types.StaffActor
	DocumentKey   string
	FromVersionId string
	Reason        string
}
