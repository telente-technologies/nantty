package reviewbusinessdocument

import "nantty/modules/users/src/types"

type Command struct {
	Actor      types.StaffActor
	AccountId  string
	DocumentId string
	Approve    bool
	Reason     string
}
