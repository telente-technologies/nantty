package dtos

type RecordBrandDealRequestDto struct {
	BrandName   string  `json:"brandName"`
	AmountMinor int64   `json:"amountMinor"`
	Currency    string  `json:"currency"`
	StartsAt    string  `json:"startsAt"`
	EndsAt      *string `json:"endsAt"`
	Disclosure  string  `json:"disclosure"`
	Notes       string  `json:"notes"`
}

type MoneyDto struct {
	AmountMinor int64  `json:"amountMinor"`
	Currency    string `json:"currency"`
}

type BrandDealDto struct {
	Id         string   `json:"id"`
	BrandName  string   `json:"brandName"`
	Amount     MoneyDto `json:"amount"`
	StartsAt   string   `json:"startsAt"`
	EndsAt     *string  `json:"endsAt"`
	Disclosure string   `json:"disclosure"`
	Notes      string   `json:"notes"`
	CreatedAt  string   `json:"createdAt"`
}
