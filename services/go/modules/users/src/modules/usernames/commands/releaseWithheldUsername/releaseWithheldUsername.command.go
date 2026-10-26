package releasewithheldusername

import "nantty/modules/users/src/types"

type Command struct {
	Actor    types.StaffActor
	Username string
	Reason   string
}
