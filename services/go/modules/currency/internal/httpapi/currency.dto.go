package httpapi

type SetExchangeRateRequest struct {
	Rate               string `json:"rate"`
	Reason             string `json:"reason"`
	ConfirmLargeChange bool   `json:"confirmLargeChange"`
}

type CountryView struct {
	CountryCode  string `json:"countryCode"`
	CountryName  string `json:"countryName"`
	Currency     string `json:"currency"`
	CurrencyName string `json:"currencyName"`
}

type ListResponse[Item any] struct {
	Data       []Item  `json:"data"`
	NextCursor *string `json:"nextCursor"`
}
