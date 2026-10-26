package reclaimwithheldusername

import "nantty/modules/users/src/types"

const (
	ModeRestoreToOwner   = "RESTORE_TO_OWNER"
	ModeAssignToClaimant = "ASSIGN_TO_CLAIMANT"
)

type Command struct {
	Actor          types.StaffActor
	TargetId       string
	Reason         string
	Mode           string
	ClaimantUserId string
}
