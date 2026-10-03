package constants

import "testing"

func TestCountryToCurrencyMapping(t *testing.T) {
	cases := map[string]struct {
		currency  string
		supported bool
	}{
		"NG": {"NGN", true}, "GH": {"GHS", true}, "KE": {"KES", true}, "ZA": {"ZAR", true}, "GB": {"GBP", true},
		"DE": {"EUR", true}, "FR": {"EUR", true}, "IE": {"EUR", true}, "US": {"USD", true}, "JP": {"USD", false}, "": {"USD", false},
	}
	for code, want := range cases {
		currency, supported := CurrencyForCountry(code)
		if currency != want.currency || supported != want.supported {
			t.Errorf("%q: got %s %v", code, currency, supported)
		}
	}
	for _, country := range SupportedCountries() {
		if _, found := FindSupportedCurrency(country.Currency); !found {
			t.Errorf("%s maps to unsupported currency %s", country.Code, country.Currency)
		}
	}
}

func TestNormalizeCountryCode(t *testing.T) {
	for raw, want := range map[string]string{"ng": "NG", " Gh ": "GH", "NGA": "", "1A": "", "": "", "XX": "XX"} {
		if got := NormalizeCountryCode(raw); got != want {
			t.Errorf("%q: got %q want %q", raw, got, want)
		}
	}
}

func TestDefaultRatesAreConsistent(t *testing.T) {
	usd, _ := FindSupportedCurrency("USD")
	if usd.DefaultE8 != 100_000_000 || len(SupportedCurrencies()) != 7 {
		t.Fatal("USD must be 1 and seven currencies supported")
	}
}
