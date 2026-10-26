package reassignusername

import "nantty/modules/users/src/types"

type Command struct {
	Actor           types.StaffActor
	OwnerId         string
	RecipientUserId string
	Reason          string
}
