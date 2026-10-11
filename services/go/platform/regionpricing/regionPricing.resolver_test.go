package regionpricing

import (
	"net/http/httptest"
	"testing"
)

func TestRegionResolutionPrefersStorefrontThenProfileThenIpThenFallsBackToUsd(t *testing.T) {
	cases := []struct {
		name     string
		signals  Signals
		region   string
		currency string
		source   string
		fallback bool
	}{
		{"apple storefront beats everything", Signals{ClientPlatform: "ios", Storefront: "GBR", ProfileCountry: "NG", TrustedHeaderCountry: "KE", ClientRegionHint: "ZA"}, "GB", "GBP", SourceStorefront, false},
		{"play billing country beats profile", Signals{ClientPlatform: "android", Storefront: "ke", ProfileCountry: "NG"}, "KE", "KES", SourceStorefront, false},
		{"eurozone storefront maps to EU", Signals{ClientPlatform: "ios", Storefront: "DEU"}, "EU", "EUR", SourceStorefront, false},
		{"unsupported storefront pays US prices", Signals{ClientPlatform: "ios", Storefront: "JPN", ProfileCountry: "NG"}, "US", "USD", SourceStorefront, true},
		{"web ignores a storefront header", Signals{ClientPlatform: "web", Storefront: "NGA", ProfileCountry: "GB"}, "GB", "GBP", SourceProfile, false},
		{"profile beats the CDN header", Signals{ProfileCountry: "GH", TrustedHeaderCountry: "NG"}, "GH", "GHS", SourceProfile, false},
		{"CDN header beats IP and hint", Signals{TrustedHeaderCountry: "ZA", IpCountry: "NG", ClientRegionHint: "KE"}, "ZA", "ZAR", SourceTrustedProxy, false},
		{"IP beats the client hint", Signals{IpCountry: "FR", ClientRegionHint: "NG"}, "EU", "EUR", SourceIp, false},
		{"client hint is last", Signals{ClientRegionHint: "ng"}, "NG", "NGN", SourceClientHint, false},
		{"unknown country falls back to US", Signals{ProfileCountry: "BR"}, "US", "USD", SourceProfile, true},
		{"nothing known falls back to US", Signals{}, "US", "USD", SourceFallback, true},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			resolved := ResolvePricingRegion(testCase.signals)
			if resolved.Region != testCase.region || resolved.Currency != testCase.currency || resolved.Source != testCase.source || resolved.IsFallback != testCase.fallback {
				t.Fatalf("got %+v", resolved)
			}
		})
	}
}

func TestReadSignalsFromRequestUsesTheConfiguredTrustedHeader(t *testing.T) {
	request := httptest.NewRequest("GET", "/", nil)
	request.RemoteAddr = "10.0.4.7:41000"
	request.Header.Set("X-Client-Platform", "android")
	request.Header.Set("X-Store-Storefront", "ZA")
	request.Header.Set("CloudFront-Viewer-Country", "NG")
	signals := ReadSignalsFromRequest(request, DefaultTrustedCountryKey, "")
	if signals.Storefront != "ZA" || signals.TrustedHeaderCountry != "NG" || ResolvePricingRegion(signals).Region != "ZA" {
		t.Fatalf("signals %+v", signals)
	}
	if ReadSignalsFromRequest(request, "", "").TrustedHeaderCountry != "" {
		t.Fatal("an unconfigured trusted header must be ignored")
	}
	request.RemoteAddr = "203.0.113.50:41000"
	if ReadSignalsFromRequest(request, DefaultTrustedCountryKey, "").TrustedHeaderCountry != "" {
		t.Fatal("a CDN country header sent straight from the internet must be ignored")
	}
}

func TestStorefrontCountryRejectsGarbage(t *testing.T) {
	for _, raw := range []string{"", "N", "NG1", "1234", "N-G"} {
		if _, known := StorefrontCountry(raw); known {
			t.Fatalf("%q accepted", raw)
		}
	}
}

func TestWebBillingFallsBackToUsdThenRefuses(t *testing.T) {
	provider := func(enabled ...string) func(string) bool {
		return func(currency string) bool {
			for _, candidate := range enabled {
				if candidate == currency {
					return true
				}
			}
			return false
		}
	}
	if got := DecideWebBilling("NGN", provider("NGN", "USD")); got.Currency != "NGN" || got.UsdFallback || got.NotAvailable {
		t.Fatalf("NGN %+v", got)
	}
	for _, currency := range []string{"GBP", "EUR", "GHS", "KES", "ZAR"} {
		if got := DecideWebBilling(currency, provider("NGN", "USD")); got.Currency != "USD" || !got.UsdFallback {
			t.Fatalf("%s should be billed in USD: %+v", currency, got)
		}
	}
	if got := DecideWebBilling("GBP", provider("NGN")); !got.NotAvailable {
		t.Fatalf("without USD enabled GBP can't be charged: %+v", got)
	}
	if got := DecideWebBilling("USD", provider("NGN", "USD")); got.UsdFallback {
		t.Fatalf("US buyers aren't a fallback: %+v", got)
	}
}
