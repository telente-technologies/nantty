package listreservedusernamerules

type Query struct {
	Cursor string
}

type Rule struct {
	Id        string `json:"id"`
	Term      string `json:"term"`
	MatchKind string `json:"matchKind"`
	CreatedAt string `json:"createdAt"`
}

type Page struct {
	Data       []Rule  `json:"data"`
	NextCursor *string `json:"nextCursor"`
}
