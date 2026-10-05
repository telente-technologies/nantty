package services

import (
	"errors"
	"net"
	"net/url"
	"regexp"
	"strings"

	"zudomart/modules/ads/src/types"
)

var (
	ErrDestinationUnavailable = errors.New("creative has no approved destination for this click")
	ErrCardOutOfRange         = errors.New("card index is outside the creative")
)

var deepLinkPattern = regexp.MustCompile(`^[a-z][a-z0-9+.-]{1,30}://[^\s<>"']{0,500}$`)
var forbiddenDeepLinkSchemes = map[string]bool{"javascript": true, "data": true, "file": true, "http": true, "https": true, "vbscript": true, "blob": true, "intent": true}

var linkShorteners = []string{"bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly", "cutt.ly", "rb.gy", "shorturl.at"}

func ValidateHttpsUrl(raw string) (*url.URL, bool) {
	if raw == "" || len(raw) > 2048 || strings.ContainsAny(raw, " \t\r\n\\") {
		return nil, false
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Scheme != "https" || parsed.Hostname() == "" || parsed.User != nil {
		return nil, false
	}
	return parsed, true
}

func ValidIosStoreUrl(raw string) bool {
	parsed, ok := ValidateHttpsUrl(raw)
	if !ok {
		return false
	}
	host := strings.ToLower(parsed.Hostname())
	return (host == "apps.apple.com" || host == "itunes.apple.com") && strings.Contains(parsed.Path, "/app/")
}

func ValidAndroidStoreUrl(raw string) bool {
	parsed, ok := ValidateHttpsUrl(raw)
	if !ok {
		return false
	}
	return strings.ToLower(parsed.Hostname()) == "play.google.com" && parsed.Path == "/store/apps/details" && parsed.Query().Get("id") != ""
}

func ValidDeepLink(raw string) bool {
	if !deepLinkPattern.MatchString(raw) {
		return false
	}
	scheme := raw[:strings.Index(raw, "://")]
	return !forbiddenDeepLinkSchemes[scheme]
}

func hostMatches(host, domain string) bool {
	return host == domain || strings.HasSuffix(host, "."+domain)
}

func DestinationHostFlags(raw string, blockedDomains []string) []types.AutoCheckFlag {
	parsed, ok := ValidateHttpsUrl(raw)
	if !ok {
		return nil
	}
	host := strings.ToLower(parsed.Hostname())
	for _, blocked := range blockedDomains {
		if blocked = strings.ToLower(strings.TrimSpace(blocked)); blocked != "" && hostMatches(host, blocked) {
			return []types.AutoCheckFlag{{PolicyCategoryId: "malicious_destination", Label: "Blocked or unsafe destination", Severity: "CRITICAL", Detail: "The destination domain " + host + " is on the blocked list."}}
		}
	}
	if net.ParseIP(host) != nil || strings.Contains(host, "xn--") {
		return []types.AutoCheckFlag{{PolicyCategoryId: "malicious_destination", Label: "Suspicious destination host", Severity: "HIGH", Detail: "The destination uses a raw IP address or an internationalised lookalike domain."}}
	}
	for _, shortener := range linkShorteners {
		if hostMatches(host, shortener) {
			return []types.AutoCheckFlag{{PolicyCategoryId: "malicious_destination", Label: "Link shortener destination", Severity: "HIGH", Detail: "Shortened links hide the real destination; use the full link."}}
		}
	}
	return nil
}

func ApplyUtm(raw string, utm *types.CreativeUtm) (string, error) {
	parsed, ok := ValidateHttpsUrl(raw)
	if !ok {
		return "", ErrDestinationUnavailable
	}
	if utm == nil {
		return parsed.String(), nil
	}
	query := parsed.Query()
	set := func(key, value, fallback string) {
		if value = strings.TrimSpace(value); value == "" {
			value = fallback
		}
		if value != "" && query.Get(key) == "" {
			query.Set(key, value)
		}
	}
	set("utm_source", utm.Source, "zudomart")
	set("utm_medium", utm.Medium, "paid")
	set("utm_campaign", utm.Campaign, "")
	set("utm_content", utm.Content, "")
	set("utm_term", utm.Term, "")
	parsed.RawQuery = query.Encode()
	return parsed.String(), nil
}

func SelectAppLink(app *types.CreativeApp, platform string) (string, bool) {
	if app == nil {
		return "", false
	}
	switch platform {
	case "ios":
		if app.IosStoreUrl != "" {
			return app.IosStoreUrl, true
		}
	case "android":
		if app.AndroidStoreUrl != "" {
			return app.AndroidStoreUrl, true
		}
	}
	return app.WebFallbackUrl, app.WebFallbackUrl != ""
}

func deepLinkFor(app *types.CreativeApp, platform string) string {
	if app == nil {
		return ""
	}
	if platform == "ios" {
		return app.IosDeepLink
	}
	if platform == "android" {
		return app.AndroidDeepLink
	}
	return ""
}

func internalLink(destination types.CreativeDestination) (string, bool) {
	switch destination.Type {
	case "post", "product", "store", "profile":
		if destination.TargetId != nil && *destination.TargetId != "" {
			return "zudomart://" + destination.Type + "/" + url.PathEscape(*destination.TargetId), true
		}
	case "messages":
		return "zudomart://messages", true
	}
	return "", false
}

func resolveDestination(destination types.CreativeDestination, app *types.CreativeApp, platform string) (string, error) {
	if destination.Type == "app_store" {
		link, ok := SelectAppLink(app, platform)
		if !ok {
			return "", ErrDestinationUnavailable
		}
		return link, nil
	}
	if destination.Type == "url" && destination.Url != nil {
		return ApplyUtm(*destination.Url, destination.Utm)
	}
	if link, ok := internalLink(destination); ok {
		return link, nil
	}
	return "", ErrDestinationUnavailable
}

func IsSafeClickTarget(target string) bool {
	if strings.HasPrefix(target, "zudomart://") {
		return deepLinkPattern.MatchString(target)
	}
	_, ok := ValidateHttpsUrl(target)
	return ok
}

func ResolveClickTarget(creative types.Creative, cardIndex int, platform string) (string, error) {
	if creative.Type == "carousel" || len(creative.Cards) > 0 {
		if cardIndex < 0 || cardIndex >= len(creative.Cards) {
			return "", ErrCardOutOfRange
		}
		return resolveDestination(creative.Cards[cardIndex].Destination, creative.App, platform)
	}
	return resolveDestination(creative.Destination, creative.App, platform)
}

func DeepLinkForPlatform(creative types.Creative, platform string) string {
	return deepLinkFor(creative.App, platform)
}

func PlatformFromUserAgent(userAgent string) string {
	lower := strings.ToLower(userAgent)
	switch {
	case strings.Contains(lower, "iphone") || strings.Contains(lower, "ipad") || strings.Contains(lower, "ios"):
		return "ios"
	case strings.Contains(lower, "android"):
		return "android"
	}
	return "web"
}
