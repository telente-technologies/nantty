package releasewithheldusername

import "zudomart/modules/users/src/types"

type Command struct {
	Actor    types.StaffActor
	Username string
	Reason   string
}
