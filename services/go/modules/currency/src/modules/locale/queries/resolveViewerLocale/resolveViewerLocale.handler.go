package resolveviewerlocale

import (
	"context"
	"log/slog"

	"github.com/google/uuid"

	"nantty/modules/currency/src/constants"
	"nantty/modules/currency/src/container"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, request Query) (Result, error) {
	country, source := handler.detectViewerCountry(ctx, request)
	if country == "" {
		return Result{Currency: constants.FixedBaseCurrency, Source: "unknown"}, nil
	}
	currency, supported := constants.CurrencyForCountry(country)
	return Result{CountryCode: &country, Currency: currency, IsCountrySupported: supported, Source: source}, nil
}

func (handler Handler) detectViewerCountry(ctx context.Context, request Query) (string, string) {
	if country := handler.findProfileCountry(ctx, request.AccountId); country != "" {
		return country, "profile"
	}
	if country := constants.NormalizeCountryCode(request.TrustedHeaderCountry); country != "" {
		return country, "trusted_proxy_header"
	}
	if country := handler.findIpCountry(ctx, request.RemoteAddress); country != "" {
		return country, "ip_geolocation"
	}
	if country := constants.NormalizeCountryCode(request.ClientRegionHint); country != "" {
		return country, "client_region_hint"
	}
	return "", "unknown"
}

func (handler Handler) findProfileCountry(ctx context.Context, accountId uuid.UUID) string {
	if accountId == uuid.Nil {
		return ""
	}
	lookup, err := handler.Container.Identity.AccountCountryLookup()
	if err != nil {
		return ""
	}
	country, err := lookup.FindAccountCountryCode(ctx, accountId)
	if err != nil {
		handler.Container.Logger.WarnContext(ctx, "profile country lookup failed", slog.Any("error", err))
		return ""
	}
	return constants.NormalizeCountryCode(country)
}

func (handler Handler) findIpCountry(ctx context.Context, remoteAddress string) string {
	if handler.Container.IpLookup == nil || remoteAddress == "" {
		return ""
	}
	country, err := handler.Container.IpLookup.FindCountryCodeForIpAddress(ctx, remoteAddress)
	if err != nil {
		return ""
	}
	return constants.NormalizeCountryCode(country)
}
