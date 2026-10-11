package viewerregion

import (
	"context"
	"net/http"

	"zudomart/platform/httpserver"
)

const (
	ClientRegionHeader        = "X-Client-Region"
	DefaultTrustedCountryName = "CloudFront-Viewer-Country"

	SourceProfile      = "profile"
	SourceTrustedProxy = "trusted_proxy_header"
	SourceClientHint   = "client_region_hint"
	SourceUnknown      = "unknown"
)

type Signals struct {
	TrustedHeaderCountry string
	ClientRegionHint     string
}

type signalsKey struct{}

func CaptureSignals(trustedHeader string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			signals := Signals{ClientRegionHint: NormalizeCountryCode(request.Header.Get(ClientRegionHeader))}
			if trustedHeader != "" && httpserver.IsFromTrustedProxy(request) {
				signals.TrustedHeaderCountry = NormalizeCountryCode(request.Header.Get(trustedHeader))
			}
			next.ServeHTTP(writer, request.WithContext(context.WithValue(request.Context(), signalsKey{}, signals)))
		})
	}
}

func SignalsFromContext(ctx context.Context) Signals {
	signals, _ := ctx.Value(signalsKey{}).(Signals)
	return signals
}

func Resolve(profileCountry string, signals Signals) (country, source string) {
	if code := NormalizeCountryCode(profileCountry); code != "" {
		return code, SourceProfile
	}
	if code := NormalizeCountryCode(signals.TrustedHeaderCountry); code != "" {
		return code, SourceTrustedProxy
	}
	if code := NormalizeCountryCode(signals.ClientRegionHint); code != "" {
		return code, SourceClientHint
	}
	return "", SourceUnknown
}
