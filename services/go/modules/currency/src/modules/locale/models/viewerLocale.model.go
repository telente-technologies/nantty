package models

type ViewerLocale struct {
	CountryCode        *string `json:"countryCode"`
	Currency           string  `json:"currency"`
	IsCountrySupported bool    `json:"isCountrySupported"`
	Source             string  `json:"source"`
}
