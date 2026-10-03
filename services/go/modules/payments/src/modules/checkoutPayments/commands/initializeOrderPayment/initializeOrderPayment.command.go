package initializeorderpayment

type Command struct {
	BuyerUserId    string
	OrderId        string
	CheckoutId     string
	Provider       string
	ReturnTo       string
	IdempotencyKey string
}
