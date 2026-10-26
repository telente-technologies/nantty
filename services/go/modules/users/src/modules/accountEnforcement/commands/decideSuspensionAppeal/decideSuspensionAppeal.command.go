package decidesuspensionappeal

import "nantty/modules/users/src/types"

type Command struct {
	Actor        types.StaffActor
	SuspensionId string
	Outcome      string
	Reason       string
}
