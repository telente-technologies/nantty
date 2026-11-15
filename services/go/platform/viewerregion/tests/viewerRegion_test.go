package viewerregion_test

import (
	"context"
	. "nantty/platform/viewerregion"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestResolveOrderIsProfileThenProxyThenHint(t *testing.T) {
	cases := []struct {
		profile string
		signals Signals
		country string
		source  string
	}{
		{"gh", Signals{TrustedHeaderCountry: "NG", ClientRegionHint: "KE"}, "GH", SourceProfile},
		{"", Signals{TrustedHeaderCountry: "NG", ClientRegionHint: "KE"}, "NG", SourceTrustedProxy},
		{"", Signals{ClientRegionHint: "KE"}, "KE", SourceClientHint},
		{"xyz", Signals{}, "", SourceUnknown},
	}
	for _, testCase := range cases {
		country, source := Resolve(testCase.profile, testCase.signals)
		if country != testCase.country || source != testCase.source {
			t.Errorf("%+v: got %q %q", testCase, country, source)
		}
	}
}

func TestCaptureSignalsReadsTheTrustedHeaderAndTheHint(t *testing.T) {
	var seen Signals
	handler := CaptureSignals("CloudFront-Viewer-Country")(http.HandlerFunc(func(_ http.ResponseWriter, request *http.Request) {
		seen = SignalsFromContext(request.Context())
	}))
	request := httptest.NewRequest("GET", "/", nil)
	request.RemoteAddr = "10.0.4.7:41000"
	request.Header.Set("CloudFront-Viewer-Country", "de")
	request.Header.Set(ClientRegionHeader, "za")
	handler.ServeHTTP(httptest.NewRecorder(), request)
	if seen.TrustedHeaderCountry != "DE" || seen.ClientRegionHint != "ZA" {
		t.Fatalf("unexpected %+v", seen)
	}
	request.RemoteAddr = "203.0.113.50:41000"
	handler.ServeHTTP(httptest.NewRecorder(), request)
	if seen.TrustedHeaderCountry != "" {
		t.Fatalf("a CDN country header from an untrusted peer must be ignored, got %+v", seen)
	}
	if (SignalsFromContext(context.Background()) != Signals{}) {
		t.Fatal("empty context has no signals")
	}
}

func TestCurrencyForCountryAndConversionRoundDown(t *testing.T) {
	if currency, supported := CurrencyForCountry("de"); currency != "EUR" || !supported {
		t.Fatalf("got %s %v", currency, supported)
	}
	if currency, supported := CurrencyForCountry("JP"); currency != "USD" || supported {
		t.Fatalf("got %s %v", currency, supported)
	}
	rates := map[string]int64{"USD": 100_000_000, "NGN": 155_000_000_000, "GHS": 1_550_000_000}
	converted, err := ConvertMinorUnits(155_000, "NGN", "GHS", rates)
	if err != nil || converted != 1_550 {
		t.Fatalf("got %d %v", converted, err)
	}
	if _, err := ConvertMinorUnits(100, "NGN", "JPY", rates); err == nil {
		t.Fatal("a missing rate must be reported")
	}
}
