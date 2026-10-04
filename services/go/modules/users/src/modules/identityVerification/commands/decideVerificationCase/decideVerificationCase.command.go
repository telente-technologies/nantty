package decideverificationcase

import "zudomart/modules/users/src/types"

const (
	ActionApprove = "approve"
	ActionReject  = "reject"
)

type Command struct {
	Actor  types.StaffActor
	CaseId string
	Action string
	Reason string
}
