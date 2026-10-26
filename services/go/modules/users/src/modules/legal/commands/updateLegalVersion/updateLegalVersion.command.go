package updatelegalversion

import "nantty/modules/users/src/types"

type Command struct {
	Actor            types.StaffActor
	VersionId        string
	BodyMarkdown     string
	ChangeSummary    string
	EffectiveAt      string
	IsMaterialChange bool
}
