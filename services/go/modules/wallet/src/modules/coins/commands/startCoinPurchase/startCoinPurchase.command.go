package startcoinpurchase

type Command struct {
	UserId         string
	ClientPlatform string
	PackageId      string
	Provider       string
	Currency       string
	ReturnTo       string
	IdempotencyKey string
}
