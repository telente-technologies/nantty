package services

import (
	"slices"
	"strings"
	"time"
)

var currencyByCountry = map[string]string{"NG": "NGN", "GH": "GHS", "KE": "KES", "ZA": "ZAR", "GB": "GBP", "US": "USD"}

var euroCountries = []string{"DE", "FR", "IT", "ES", "NL", "BE", "IE", "PT", "AT", "FI", "GR"}

func CurrencyForCountry(countryCode string) string {
	code := strings.ToUpper(countryCode)
	if currency, found := currencyByCountry[code]; found {
		return currency
	}
	if slices.Contains(euroCountries, code) {
		return "EUR"
	}
	return "USD"
}

func IsKnownTimezone(name string) bool {
	_, err := time.LoadLocation(name)
	return err == nil && name != ""
}

var AccountRoles = []string{"admin", "advertiser", "analyst", "billing"}

func IsAccountRole(role string) bool { return slices.Contains(AccountRoles, role) }

func CountryForCurrency(currency string) string {
	for country, candidate := range currencyByCountry {
		if candidate == currency {
			return country
		}
	}
	if currency == "EUR" {
		return "DE"
	}
	return "NG"
}
