package utils

import (
	"net/url"
	"regexp"
	"slices"
	"strings"
)

var adsAccountReturnPath = regexp.MustCompile(`^/accounts/[A-Za-z0-9_-]{1,80}/billing/return$`)

func IsAdsAccountReturnUrl(raw string, allowedOrigins []string) bool {
	if raw == "" || len(raw) > 300 || strings.ContainsAny(raw, "\\\r\n\t ") {
		return false
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.User != nil || parsed.RawQuery != "" || parsed.ForceQuery || parsed.Fragment != "" || parsed.Opaque != "" || parsed.RawPath != "" {
		return false
	}
	if parsed.Scheme != "https" && parsed.Scheme != "http" {
		return false
	}
	origin := parsed.Scheme + "://" + parsed.Host
	return slices.Contains(allowedOrigins, origin) && adsAccountReturnPath.MatchString(parsed.Path)
}
