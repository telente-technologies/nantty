package listactivesessions

type Query struct {
	AccountId        string
	CurrentSessionId string
	Cursor           string
}

type ActiveSessionView struct {
	Id         string `json:"id"`
	UserAgent  string `json:"userAgent"`
	IpAddress  string `json:"ipAddress"`
	CreatedAt  string `json:"createdAt"`
	LastUsedAt string `json:"lastUsedAt"`
	Current    bool   `json:"current"`
}

type Page struct {
	Data       []ActiveSessionView `json:"data"`
	NextCursor *string             `json:"nextCursor"`
}
