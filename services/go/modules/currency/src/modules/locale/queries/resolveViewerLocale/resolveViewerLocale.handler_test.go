package resolveviewerlocale

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"testing"

	"github.com/google/uuid"

	"nantty/modules/currency/src/configs"
	"nantty/modules/currency/src/container"
	"nantty/platform/identityports"
)

type stubProfileCountry struct{ country string }

func (stub stubProfileCountry) FindAccountCountryCode(context.Context, uuid.UUID) (string, error) {
	if stub.country == "ERR" {
		return "", errors.New("boom")
	}
	return stub.country, nil
}

type stubIpLookup struct{ country string }

func (stub stubIpLookup) FindCountryCodeForIpAddress(context.Context, string) (string, error) {
	return stub.country, nil
}

func TestViewerLocaleResolutionOrder(t *testing.T) {
	account := uuid.New()
	cases := []struct {
		name         string
		profile      string
		request      Query
		ip           string
		wantCountry  string
		wantCurrency string
		wantSource   string
		wantSupport  bool
	}{
		{"profile wins", "GH", Query{AccountId: account, TrustedHeaderCountry: "NG", ClientRegionHint: "KE"}, "ZA", "GH", "GHS", "profile", true},
		{"profile lookup failure falls through", "ERR", Query{AccountId: account, TrustedHeaderCountry: "ng"}, "", "NG", "NGN", "trusted_proxy_header", true},
		{"anonymous ignores profile", "GH", Query{TrustedHeaderCountry: "GB"}, "", "GB", "GBP", "trusted_proxy_header", true},
		{"ip when no header", "", Query{RemoteAddress: "1.2.3.4", ClientRegionHint: "KE"}, "DE", "DE", "EUR", "ip_geolocation", true},
		{"hint last", "", Query{ClientRegionHint: "za"}, "", "ZA", "ZAR", "client_region_hint", true},
		{"unsupported country uses USD", "", Query{TrustedHeaderCountry: "JP"}, "", "JP", "USD", "trusted_proxy_header", false},
		{"invalid values ignored", "", Query{TrustedHeaderCountry: "XYZ", ClientRegionHint: "1"}, "", "", "USD", "unknown", false},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			registry := &identityports.Registry{}
			registry.RegisterAccountCountryLookup(stubProfileCountry{country: testCase.profile})
			deployed := container.NewContainer(nil, configs.CurrencySettings{}, slog.New(slog.NewTextHandler(io.Discard, nil)))
			deployed.Identity = registry
			if testCase.ip != "" {
				deployed.IpLookup = stubIpLookup{country: testCase.ip}
			}
			locale, _ := Handler{Container: deployed}.Execute(context.Background(), testCase.request)
			gotCountry := ""
			if locale.CountryCode != nil {
				gotCountry = *locale.CountryCode
			}
			if gotCountry != testCase.wantCountry || locale.Currency != testCase.wantCurrency || locale.Source != testCase.wantSource || locale.IsCountrySupported != testCase.wantSupport {
				t.Fatalf("got %+v country=%q", locale, gotCountry)
			}
		})
	}
}
