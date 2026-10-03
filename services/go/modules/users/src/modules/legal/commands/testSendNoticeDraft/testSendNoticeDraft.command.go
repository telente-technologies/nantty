package testsendnoticedraft

import "zudomart/modules/users/src/types"

type Command struct {
	Actor     types.StaffActor
	VersionId string
}
