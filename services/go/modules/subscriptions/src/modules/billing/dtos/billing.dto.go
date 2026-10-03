package dtos

type CheckoutRequestDto struct {
	ProfileId string `json:"profileId"`
	PlanCode  string `json:"planCode"`
	PlanId    string `json:"planId"`
	Interval  string `json:"interval"`
	WithTrial bool   `json:"withTrial"`
	ReturnTo  string `json:"returnTo"`
}

type StoreReceiptRequestDto struct {
	Platform      string `json:"platform"`
	ProfileId     string `json:"profileId"`
	ProductId     string `json:"productId"`
	Receipt       string `json:"receipt"`
	TransactionId string `json:"transactionId"`
}

type PriceRowRequestDto struct {
	Currency           string `json:"currency"`
	MonthlyAmountMinor int64  `json:"monthlyAmountMinor"`
	Active             bool   `json:"active"`
}
