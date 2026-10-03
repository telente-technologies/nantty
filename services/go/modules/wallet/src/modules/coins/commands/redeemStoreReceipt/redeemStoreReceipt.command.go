package redeemstorereceipt

type Command struct {
	UserId         string
	Platform       string
	ProductId      string
	Receipt        string
	TransactionId  string
	IdempotencyKey string
}
