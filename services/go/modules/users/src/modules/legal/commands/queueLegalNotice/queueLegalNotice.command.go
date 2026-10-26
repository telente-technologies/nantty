package queuelegalnotice

import "nantty/modules/users/src/types"

type Command struct {
	Actor     types.StaffActor
	VersionId string
	Reason    string
}
