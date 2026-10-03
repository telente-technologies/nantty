package services

import "zudomart/modules/currency/src/constants"

type CountryCurrencyResolver struct{}

func (CountryCurrencyResolver) CurrencyForCountry(countryCode string) (string, bool) {
	return constants.CurrencyForCountry(constants.NormalizeCountryCode(countryCode))
}
