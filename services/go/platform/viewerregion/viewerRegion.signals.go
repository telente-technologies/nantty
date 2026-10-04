package viewerregion

import (
	"context"
	"net/http"
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

// CaptureSignals records the edge-resolved country (IP geolocation happens at the proxy) and the client hint on the request context.
func CaptureSignals(trustedHeader string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			signals := Signals{ClientRegionHint: NormalizeCountryCode(request.Header.Get(ClientRegionHeader))}
			if trustedHeader != "" {
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

// Resolve follows the currency module's order: profile country, then the IP-derived proxy header, then the client hint.
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
