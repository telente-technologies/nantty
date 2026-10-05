package dtos

type ChangeUsernameRequest struct {
	Username string `json:"username"`
}

type WithholdUsernameRequest struct {
	Username string `json:"username"`
	Reason   string `json:"reason"`
	Note     string `json:"note"`
}

type AddReservedUsernameRuleRequest struct {
	Term      string `json:"term"`
	MatchKind string `json:"matchKind"`
	Category  string `json:"category"`
	Note      string `json:"note"`
	Reason    string `json:"reason"`
}
