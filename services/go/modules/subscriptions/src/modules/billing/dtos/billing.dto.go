package dtos

type CheckoutRequestDto struct {
	ProfileId    string `json:"profileId"`
	PlanCode     string `json:"planCode"`
	PlanId       string `json:"planId"`
	Interval     string `json:"interval"`
	WithTrial    bool   `json:"withTrial"`
	ReturnTo     string `json:"returnTo"`
	OfferClaimId string `json:"offerClaimId"`
}

type StoreReceiptRequestDto struct {
	Platform      string `json:"platform"`
	ProfileId     string `json:"profileId"`
	ProductId     string `json:"productId"`
	Receipt       string `json:"receipt"`
	TransactionId string `json:"transactionId"`
}

type PriceRowRequestDto struct {
	Currency                  string            `json:"currency"`
	MonthlyAmountMinor        int64             `json:"monthlyAmountMinor"`
	YearlyAmountMinor         int64             `json:"yearlyAmountMinor"`
	IosMonthlyAmountMinor     int64             `json:"iosMonthlyAmountMinor"`
	IosYearlyAmountMinor      int64             `json:"iosYearlyAmountMinor"`
	AndroidMonthlyAmountMinor int64             `json:"androidMonthlyAmountMinor"`
	AndroidYearlyAmountMinor  int64             `json:"androidYearlyAmountMinor"`
	StoreProductIds           map[string]string `json:"storeProductIds"`
	Active                    bool              `json:"active"`
	Reason                    string            `json:"reason"`
}

type ChangePlanRequestDto struct {
	PlanCode string `json:"planCode"`
	PlanId   string `json:"planId"`
	Interval string `json:"interval"`
}

type PayNowRequestDto struct {
	ReturnTo string `json:"returnTo"`
}
