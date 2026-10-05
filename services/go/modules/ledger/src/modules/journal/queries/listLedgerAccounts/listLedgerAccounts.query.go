package listledgeraccounts

type Query struct {
	Currency  string
	OwnerId   string
	AfterCode string
	Limit     int
}
