package listreservedusernamerules

type Query struct {
	Cursor string
	Search string
	Kind   string
}

type Rule struct {
	Id                       string `json:"id"`
	Term                     string `json:"term"`
	MatchKind                string `json:"matchKind"`
	Category                 string `json:"category"`
	Note                     string `json:"note"`
	Reason                   string `json:"reason"`
	CreatedByName            string `json:"createdByName"`
	ExistingAccountsMatching int    `json:"existingAccountsMatching"`
	CreatedAt                string `json:"createdAt"`
}

type Page struct {
	Data       []Rule  `json:"data"`
	NextCursor *string `json:"nextCursor"`
}
