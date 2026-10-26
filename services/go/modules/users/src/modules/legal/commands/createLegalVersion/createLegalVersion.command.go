package createlegalversion

import "nantty/modules/users/src/types"

type Command struct {
	Actor            types.StaffActor
	DocumentKey      string
	BodyMarkdown     string
	ChangeSummary    string
	EffectiveAt      string
	IsMaterialChange bool
	RolledBackFrom   *int
}
