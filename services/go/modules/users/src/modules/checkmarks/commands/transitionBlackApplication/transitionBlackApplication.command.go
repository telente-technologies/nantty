package transitionblackapplication

import "nantty/modules/users/src/types"

const (
	ActionChecklist             = "checklist"
	ActionApprove               = "approve"
	ActionReject                = "reject"
	ActionRevoke                = "revoke"
	ActionReminder              = "reminder"
	ActionRequireReverification = "require_reverification"
	ActionCheckoutAuthorization = "checkout_authorization"
)

type Command struct {
	Actor           types.StaffActor
	Id              string
	Action          string
	Key             string
	IsVerified      bool
	Note            string
	Reason          string
	CheckoutEnabled bool
	ExpiresInHours  int
}
