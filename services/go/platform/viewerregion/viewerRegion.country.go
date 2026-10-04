package viewerregion

import "strings"

var currencyByCountry = map[string]string{
	"NG": "NGN", "GH": "GHS", "KE": "KES", "ZA": "ZAR", "GB": "GBP", "US": "USD",
	"AT": "EUR", "BE": "EUR", "HR": "EUR", "CY": "EUR", "EE": "EUR", "FI": "EUR", "FR": "EUR", "DE": "EUR", "GR": "EUR", "IE": "EUR",
	"IT": "EUR", "LV": "EUR", "LT": "EUR", "LU": "EUR", "MT": "EUR", "NL": "EUR", "PT": "EUR", "SK": "EUR", "SI": "EUR", "ES": "EUR",
}

var supportedCurrencies = []string{"NGN", "GHS", "KES", "ZAR", "GBP", "EUR", "USD"}

func SupportedCurrencies() []string { return append([]string(nil), supportedCurrencies...) }

func IsSupportedCurrency(currency string) bool {
	for _, candidate := range supportedCurrencies {
		if candidate == currency {
			return true
		}
	}
	return false
}

func NormalizeCountryCode(raw string) string {
	code := strings.ToUpper(strings.TrimSpace(raw))
	if len(code) != 2 || code[0] < 'A' || code[0] > 'Z' || code[1] < 'A' || code[1] > 'Z' {
		return ""
	}
	return code
}

func CurrencyForCountry(country string) (string, bool) {
	currency, supported := currencyByCountry[NormalizeCountryCode(country)]
	if !supported {
		return "USD", false
	}
	return currency, true
}
