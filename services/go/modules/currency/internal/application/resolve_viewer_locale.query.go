package application

import (
	"context"
	"log/slog"

	"github.com/google/uuid"

	"zudomart/modules/currency/internal/catalog"
	"zudomart/platform/identityports"
)

type ViewerRequest struct {
	AccountId            uuid.UUID
	TrustedHeaderCountry string
	RemoteAddress        string
	ClientRegionHint     string
}

type ViewerLocale struct {
	CountryCode        *string `json:"countryCode"`
	Currency           string  `json:"currency"`
	IsCountrySupported bool    `json:"isCountrySupported"`
	Source             string  `json:"source"`
}

func (application *CurrencyApplication) ResolveViewerLocale(ctx context.Context, request ViewerRequest) ViewerLocale {
	country, source := application.detectViewerCountry(ctx, request)
	if country == "" {
		return ViewerLocale{Currency: catalog.FixedBaseCurrency, Source: "unknown"}
	}
	currency, supported := catalog.CurrencyForCountry(country)
	return ViewerLocale{CountryCode: &country, Currency: currency, IsCountrySupported: supported, Source: source}
}

func (application *CurrencyApplication) detectViewerCountry(ctx context.Context, request ViewerRequest) (string, string) {
	if country := application.findProfileCountry(ctx, request.AccountId); country != "" {
		return country, "profile"
	}
	if country := catalog.NormalizeCountryCode(request.TrustedHeaderCountry); country != "" {
		return country, "trusted_proxy_header"
	}
	if country := application.findIpCountry(ctx, request.RemoteAddress); country != "" {
		return country, "ip_geolocation"
	}
	if country := catalog.NormalizeCountryCode(request.ClientRegionHint); country != "" {
		return country, "client_region_hint"
	}
	return "", "unknown"
}

func (application *CurrencyApplication) findProfileCountry(ctx context.Context, accountId uuid.UUID) string {
	if accountId == uuid.Nil {
		return ""
	}
	lookup, err := identityports.Default.AccountCountryLookup()
	if err != nil {
		return ""
	}
	country, err := lookup.FindAccountCountryCode(ctx, accountId)
	if err != nil {
		application.Logger.WarnContext(ctx, "profile country lookup failed", slog.Any("error", err))
		return ""
	}
	return catalog.NormalizeCountryCode(country)
}

func (application *CurrencyApplication) findIpCountry(ctx context.Context, remoteAddress string) string {
	if application.IpLookup == nil || remoteAddress == "" {
		return ""
	}
	country, err := application.IpLookup.FindCountryCodeForIpAddress(ctx, remoteAddress)
	if err != nil {
		return ""
	}
	return catalog.NormalizeCountryCode(country)
}
