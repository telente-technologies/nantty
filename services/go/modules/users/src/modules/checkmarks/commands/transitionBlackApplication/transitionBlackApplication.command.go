package transitionblackapplication

import "nantty/modules/users/src/types"

const (
	ActionChecklist = "checklist"
	ActionApprove   = "approve"
	ActionReject    = "reject"
	ActionRevoke    = "revoke"
	ActionReminder  = "reminder"
)

type Command struct {
	Actor      types.StaffActor
	Id         string
	Action     string
	Key        string
	IsVerified bool
	Note       string
	Reason     string
}
