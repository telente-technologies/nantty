package transitionlegalversion

import "nantty/modules/users/src/types"

const (
	ActionSubmit = "submit"
	ActionReturn = "return"
)

type Command struct {
	Actor     types.StaffActor
	VersionId string
	Action    string
	Reason    string
}
