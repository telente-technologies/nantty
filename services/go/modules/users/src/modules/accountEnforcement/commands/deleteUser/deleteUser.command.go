package deleteuser

import (
	"nantty/modules/users/src/modules/accountEnforcement/services"
	"nantty/modules/users/src/types"
)

type Command struct {
	Actor           types.StaffActor
	TargetId        string
	ConfirmUsername string
	Reason          string
}

type Result struct {
	services.UserDetail
	Deletion services.RemovalOutcome `json:"deletion"`
}
