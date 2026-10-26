package suspenduser

import (
	"github.com/google/uuid"

	"nantty/modules/users/src/types"
)

type Command struct {
	Actor        types.StaffActor
	TargetId     string
	DurationDays int
	ReasonCode   string
	Reason       string
	Source       string
	CaseId       *uuid.UUID
}
