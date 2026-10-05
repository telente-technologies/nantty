package regionpricing

import "strings"

type Region struct {
	Code     string `json:"region"`
	Currency string `json:"currency"`
}

const (
	RegionNigeria       = "NG"
	RegionGhana         = "GH"
	RegionKenya         = "KE"
	RegionSouthAfrica   = "ZA"
	RegionUnitedKingdom = "GB"
	RegionEurozone      = "EU"
	RegionUnitedStates  = "US"
)

var FallbackRegion = Region{Code: RegionUnitedStates, Currency: "USD"}

var supportedRegions = []Region{
	{RegionNigeria, "NGN"}, {RegionGhana, "GHS"}, {RegionKenya, "KES"}, {RegionSouthAfrica, "ZAR"},
	{RegionUnitedKingdom, "GBP"}, {RegionEurozone, "EUR"}, {RegionUnitedStates, "USD"},
}

var eurozoneCountries = map[string]bool{
	"AT": true, "BE": true, "HR": true, "CY": true, "EE": true, "FI": true, "FR": true, "DE": true, "GR": true, "IE": true,
	"IT": true, "LV": true, "LT": true, "LU": true, "MT": true, "NL": true, "PT": true, "SK": true, "SI": true, "ES": true,
}

func SupportedRegions() []Region {
	return append([]Region(nil), supportedRegions...)
}

func NormalizeCountryCode(raw string) string {
	code := strings.ToUpper(strings.TrimSpace(raw))
	if len(code) != 2 || code[0] < 'A' || code[0] > 'Z' || code[1] < 'A' || code[1] > 'Z' {
		return ""
	}
	return code
}

func FindRegion(code string) (Region, bool) {
	for _, region := range supportedRegions {
		if region.Code == code {
			return region, true
		}
	}
	return Region{}, false
}

func RegionForCountry(countryCode string) (Region, bool) {
	country := NormalizeCountryCode(countryCode)
	if eurozoneCountries[country] {
		return Region{Code: RegionEurozone, Currency: "EUR"}, true
	}
	if country == RegionEurozone {
		return FallbackRegion, false
	}
	if region, found := FindRegion(country); found {
		return region, true
	}
	return FallbackRegion, false
}

func RegionForCurrency(currency string) (Region, bool) {
	for _, region := range supportedRegions {
		if region.Currency == strings.ToUpper(strings.TrimSpace(currency)) {
			return region, true
		}
	}
	return FallbackRegion, false
}

func IsSupportedCurrency(currency string) bool {
	_, found := RegionForCurrency(currency)
	return found
}

type WebBilling struct {
	Currency     string
	UsdFallback  bool
	NotAvailable bool
}

func DecideWebBilling(regionCurrency string, providerCanCharge func(string) bool) WebBilling {
	switch {
	case providerCanCharge(regionCurrency):
		return WebBilling{Currency: regionCurrency}
	case providerCanCharge(FallbackRegion.Currency):
		return WebBilling{Currency: FallbackRegion.Currency, UsdFallback: regionCurrency != FallbackRegion.Currency}
	}
	return WebBilling{Currency: regionCurrency, NotAvailable: true}
}
