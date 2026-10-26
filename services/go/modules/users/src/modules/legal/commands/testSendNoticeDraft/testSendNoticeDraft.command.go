package testsendnoticedraft

import "nantty/modules/users/src/types"

type Command struct {
	Actor     types.StaffActor
	VersionId string
}
