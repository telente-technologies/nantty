package dtos

type CountryView struct {
	CountryCode  string `json:"countryCode"`
	CountryName  string `json:"countryName"`
	Currency     string `json:"currency"`
	CurrencyName string `json:"currencyName"`
}

type CountriesResponse struct {
	Data       []CountryView `json:"data"`
	NextCursor *string       `json:"nextCursor"`
}
