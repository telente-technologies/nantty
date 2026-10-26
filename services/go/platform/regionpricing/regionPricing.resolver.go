package regionpricing

import (
	"net/http"
	"strings"

	"nantty/platform/httpserver"
)

const (
	StorefrontHeader         = "X-Store-Storefront"
	ClientPlatformHeader     = "X-Client-Platform"
	ClientRegionHeader       = "X-Client-Region"
	DefaultTrustedCountryKey = "CloudFront-Viewer-Country"

	SourceStorefront   = "storefront"
	SourceProfile      = "profile"
	SourceTrustedProxy = "trusted_proxy_header"
	SourceIp           = "ip_geolocation"
	SourceClientHint   = "client_region_hint"
	SourceFallback     = "fallback"
)

type Signals struct {
	ClientPlatform       string
	Storefront           string
	ProfileCountry       string
	TrustedHeaderCountry string
	IpCountry            string
	ClientRegionHint     string
}

type Resolution struct {
	CountryCode string `json:"countryCode"`
	Region      string `json:"region"`
	Currency    string `json:"currency"`
	Channel     string `json:"channel"`
	Source      string `json:"source"`
	IsFallback  bool   `json:"isFallback"`
}

func ChannelForClientPlatform(platform string) string {
	switch strings.ToLower(strings.TrimSpace(platform)) {
	case "ios":
		return "ios"
	case "android":
		return "android"
	}
	return "web"
}

func ResolvePricingRegion(signals Signals) Resolution {
	channel := ChannelForClientPlatform(signals.ClientPlatform)
	if channel != "web" {
		if country, known := StorefrontCountry(signals.Storefront); known {
			return resolutionFor(country, channel, SourceStorefront)
		}
	}
	candidates := []struct{ country, source string }{
		{signals.ProfileCountry, SourceProfile},
		{signals.TrustedHeaderCountry, SourceTrustedProxy},
		{signals.IpCountry, SourceIp},
		{signals.ClientRegionHint, SourceClientHint},
	}
	for _, candidate := range candidates {
		if country := NormalizeCountryCode(candidate.country); country != "" {
			return resolutionFor(country, channel, candidate.source)
		}
	}
	return Resolution{Region: FallbackRegion.Code, Currency: FallbackRegion.Currency, Channel: channel, Source: SourceFallback, IsFallback: true}
}

func ResolveChargingRegion(signals Signals) Resolution {
	channel := ChannelForClientPlatform(signals.ClientPlatform)
	candidates := []struct{ country, source string }{
		{signals.ProfileCountry, SourceProfile},
		{signals.TrustedHeaderCountry, SourceTrustedProxy},
		{signals.IpCountry, SourceIp},
	}
	for _, candidate := range candidates {
		if country := NormalizeCountryCode(candidate.country); country != "" {
			return resolutionFor(country, channel, candidate.source)
		}
	}
	return Resolution{Region: FallbackRegion.Code, Currency: FallbackRegion.Currency, Channel: channel, Source: SourceFallback, IsFallback: true}
}

func resolutionFor(country, channel, source string) Resolution {
	region, supported := RegionForCountry(country)
	return Resolution{CountryCode: country, Region: region.Code, Currency: region.Currency, Channel: channel, Source: source, IsFallback: !supported}
}

func ReadSignalsFromRequest(request *http.Request, trustedCountryHeader, profileCountry string) Signals {
	signals := Signals{
		ClientPlatform:   request.Header.Get(ClientPlatformHeader),
		Storefront:       request.Header.Get(StorefrontHeader),
		ProfileCountry:   profileCountry,
		ClientRegionHint: request.Header.Get(ClientRegionHeader),
	}
	if trustedCountryHeader != "" && httpserver.IsFromTrustedProxy(request) {
		signals.TrustedHeaderCountry = request.Header.Get(trustedCountryHeader)
	}
	return signals
}

var ErrCountryRequired = httpserver.NewApiError(http.StatusUnprocessableEntity, "COUNTRY_REQUIRED", "Choose your country before paying. We use it to charge you in the right currency.")

func RequireChargingCountry(resolution Resolution) (Resolution, error) {
	if resolution.CountryCode == "" || resolution.Source == SourceFallback {
		return resolution, ErrCountryRequired
	}
	return resolution, nil
}
