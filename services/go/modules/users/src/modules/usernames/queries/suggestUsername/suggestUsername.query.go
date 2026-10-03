package suggestusername

type Query struct {
	AccountId string
	Seed      string
}

type Result struct {
	Username string `json:"username"`
}
