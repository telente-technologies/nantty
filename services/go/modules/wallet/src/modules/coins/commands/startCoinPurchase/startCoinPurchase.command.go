package startcoinpurchase

type Command struct {
	UserId         string
	ClientPlatform string
	PackageId      string
	Provider       string
	CountryCode    string
	Currency       string
	ReturnTo       string
	IdempotencyKey string
}
