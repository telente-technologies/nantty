package transitionverification

import "nantty/modules/users/src/types"

const (
	ActionApprove   = "approve"
	ActionReject    = "reject"
	ActionSuspend   = "suspend"
	ActionRevoke    = "revoke"
	ActionReinstate = "reinstate"
)

type Command struct {
	Actor         types.StaffActor
	ApplicationId string
	Action        string
	Reason        string
}
