package reinstateuser

import "nantty/modules/users/src/types"

type Command struct {
	Actor        types.StaffActor
	TargetId     string
	SuspensionId string
	Reason       string
	AuditAction  string
}
