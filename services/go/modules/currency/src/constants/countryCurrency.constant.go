package constants

import "strings"

type Country struct {
	Code     string
	Name     string
	Currency string
}

var countries = []Country{
	{"NG", "Nigeria", "NGN"}, {"GH", "Ghana", "GHS"}, {"KE", "Kenya", "KES"}, {"ZA", "South Africa", "ZAR"},
	{"GB", "United Kingdom", "GBP"}, {"US", "United States", "USD"},
	{"AT", "Austria", "EUR"}, {"BE", "Belgium", "EUR"}, {"HR", "Croatia", "EUR"}, {"CY", "Cyprus", "EUR"},
	{"EE", "Estonia", "EUR"}, {"FI", "Finland", "EUR"}, {"FR", "France", "EUR"}, {"DE", "Germany", "EUR"},
	{"GR", "Greece", "EUR"}, {"IE", "Ireland", "EUR"}, {"IT", "Italy", "EUR"}, {"LV", "Latvia", "EUR"},
	{"LT", "Lithuania", "EUR"}, {"LU", "Luxembourg", "EUR"}, {"MT", "Malta", "EUR"}, {"NL", "Netherlands", "EUR"},
	{"PT", "Portugal", "EUR"}, {"SK", "Slovakia", "EUR"}, {"SI", "Slovenia", "EUR"}, {"ES", "Spain", "EUR"},
}

func SupportedCountries() []Country {
	return append([]Country(nil), countries...)
}

func NormalizeCountryCode(raw string) string {
	code := strings.ToUpper(strings.TrimSpace(raw))
	if len(code) != 2 || code[0] < 'A' || code[0] > 'Z' || code[1] < 'A' || code[1] > 'Z' {
		return ""
	}
	return code
}

func CurrencyForCountry(code string) (currency string, supported bool) {
	for _, country := range countries {
		if country.Code == code {
			return country.Currency, true
		}
	}
	return FixedBaseCurrency, false
}
