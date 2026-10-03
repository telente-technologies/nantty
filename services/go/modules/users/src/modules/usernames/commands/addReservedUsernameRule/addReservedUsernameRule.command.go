package addreservedusernamerule

import "zudomart/modules/users/src/types"

type Command struct {
	Actor     types.StaffActor
	Term      string
	MatchKind string
}

type Result struct {
	Id        string `json:"id"`
	Term      string `json:"term"`
	MatchKind string `json:"matchKind"`
}
