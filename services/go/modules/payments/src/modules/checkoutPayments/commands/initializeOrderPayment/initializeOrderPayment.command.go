package initializeorderpayment

type Command struct {
	BuyerUserId    string
	OrderId        string
	Provider       string
	ReturnTo       string
	IdempotencyKey string
}
