package utils

import (
	"net/http"
	"strings"
)

var currencyByCountry = map[string]string{
	"NG": "NGN", "GH": "GHS", "KE": "KES", "ZA": "ZAR", "GB": "GBP", "US": "USD",
	"DE": "EUR", "FR": "EUR", "IE": "EUR", "NL": "EUR", "ES": "EUR", "IT": "EUR", "PT": "EUR", "BE": "EUR", "AT": "EUR", "FI": "EUR",
}

var supportedCurrencies = map[string]bool{"NGN": true, "GHS": true, "KES": true, "ZAR": true, "GBP": true, "EUR": true, "USD": true}

type RegionHeaderCurrencyResolver struct {
	DefaultCurrency string
}

func (resolver RegionHeaderCurrencyResolver) ResolveViewerCurrency(request *http.Request) string {
	if requested := strings.ToUpper(request.URL.Query().Get("currency")); supportedCurrencies[requested] {
		return requested
	}
	if currency, known := currencyByCountry[strings.ToUpper(strings.TrimSpace(request.Header.Get("X-Client-Region")))]; known {
		return currency
	}
	return resolver.DefaultCurrency
}

func IsSupportedWalletCurrency(currency string) bool { return supportedCurrencies[currency] }
