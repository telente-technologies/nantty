package dtos

type IssueStrikeRequest struct {
	Kind          string `json:"kind"`
	Policy        string `json:"policy"`
	Reason        string `json:"reason"`
	Source        string `json:"source"`
	IssuedById    string `json:"issuedById"`
	IssuedByName  string `json:"issuedByName"`
	ReferenceType string `json:"referenceType"`
	ReferenceId   string `json:"referenceId"`
	ExpiresInDays int    `json:"expiresInDays"`
}

type RevokeStrikeRequest struct {
	Reason string `json:"reason"`
}

type CountStrikesRequest struct {
	AccountIds []string `json:"accountIds"`
}
