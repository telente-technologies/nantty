package addreservedusernamerule

import "nantty/modules/users/src/types"

type Command struct {
	Actor     types.StaffActor
	Term      string
	MatchKind string
	Category  string
	Note      string
	Reason    string
}

type Result struct {
	Id            string `json:"id"`
	Term          string `json:"term"`
	MatchKind     string `json:"matchKind"`
	Category      string `json:"category"`
	Note          string `json:"note"`
	Reason        string `json:"reason"`
	CreatedByName string `json:"createdByName"`
}
