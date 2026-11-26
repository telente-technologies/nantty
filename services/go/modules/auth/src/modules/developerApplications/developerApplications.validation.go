package developerapplications

import (
	"errors"
	"net"
	"net/url"
	"sort"
	"strconv"
	"strings"
)

var (
	errInvalidApplication              = errors.New("developer application details are invalid")
	errApplicationNotFound             = errors.New("developer application was not found")
	errApplicationForbidden            = errors.New("developer application capability is required")
	errApplicationConflict             = errors.New("developer application cannot be changed in its current state")
	errApplicationIdempotencyConflict  = errors.New("idempotency key was reused with different application details")
	errApplicationIdempotencyRequired  = errors.New("a valid idempotency key is required")
	errInvalidApplicationAccount       = errors.New("authenticated account is invalid")
	errApplicationOrganizationNotFound = errors.New("organization membership was not found")
	errInvalidApplicationGrant         = errors.New("application grant is invalid for the member role")
)

const apiProductBusinessMessaging = "business_messaging"

var supportedApplicationScopes = map[string]struct{}{
	"messages:send": {}, "messages:read": {}, "conversations:read": {}, "conversations:write": {},
	"customers:read": {}, "media:write": {}, "media:read": {}, "webhooks:manage": {}, "analytics:read": {},
}

func NormalizeDeveloperApplicationInput(input ApplicationInput) (ApplicationInput, error) {
	input.Name = strings.TrimSpace(input.Name)
	input.Purpose = strings.TrimSpace(input.Purpose)
	if len(input.Name) < 2 || len(input.Name) > 80 || len(input.Purpose) < 10 || len(input.Purpose) > 1000 {
		return ApplicationInput{}, errInvalidApplication
	}
	if len(input.CallbackOrigins) > 10 || len(input.RedirectURIs) > 10 || len(input.RequestedScopes) == 0 || len(input.RequestedScopes) > len(supportedApplicationScopes) {
		return ApplicationInput{}, errInvalidApplication
	}
	origins := make([]string, 0, len(input.CallbackOrigins))
	seenOrigins := make(map[string]struct{}, len(input.CallbackOrigins))
	for _, value := range input.CallbackOrigins {
		origin, err := normalizeCallbackOrigin(value)
		if err != nil {
			return ApplicationInput{}, errInvalidApplication
		}
		if _, exists := seenOrigins[origin]; !exists {
			seenOrigins[origin] = struct{}{}
			origins = append(origins, origin)
		}
	}
	sort.Strings(origins)
	redirectURIs := make([]string, 0, len(input.RedirectURIs))
	seenRedirectURIs := make(map[string]struct{}, len(input.RedirectURIs))
	for _, value := range input.RedirectURIs {
		redirectURI, err := normalizeApplicationRedirectURI(value)
		if err != nil {
			return ApplicationInput{}, errInvalidApplication
		}
		if _, exists := seenRedirectURIs[redirectURI]; !exists {
			seenRedirectURIs[redirectURI] = struct{}{}
			redirectURIs = append(redirectURIs, redirectURI)
		}
	}
	sort.Strings(redirectURIs)
	scopes := make([]string, 0, len(input.RequestedScopes))
	seenScopes := make(map[string]struct{}, len(input.RequestedScopes))
	for _, scope := range input.RequestedScopes {
		scope = strings.TrimSpace(scope)
		if _, allowed := supportedApplicationScopes[scope]; !allowed {
			return ApplicationInput{}, errInvalidApplication
		}
		if _, exists := seenScopes[scope]; !exists {
			seenScopes[scope] = struct{}{}
			scopes = append(scopes, scope)
		}
	}
	sort.Strings(scopes)
	input.CallbackOrigins, input.RedirectURIs, input.RequestedScopes = origins, redirectURIs, scopes
	return input, nil
}

func normalizeApplicationRedirectURI(value string) (string, error) {
	raw := strings.TrimSpace(value)
	parsed, err := url.Parse(raw)
	if err != nil || raw == "" || len(raw) > 2048 || strings.Contains(raw, "#") || parsed.Opaque != "" || parsed.User != nil || parsed.Host == "" || parsed.Fragment != "" || parsed.ForceQuery {
		return "", errInvalidApplication
	}
	query, err := url.ParseQuery(parsed.RawQuery)
	if err != nil {
		return "", errInvalidApplication
	}
	for name := range query {
		if strings.EqualFold(name, "code") || strings.EqualFold(name, "state") || strings.EqualFold(name, "error") {
			return "", errInvalidApplication
		}
	}
	scheme := strings.ToLower(parsed.Scheme)
	host := strings.ToLower(parsed.Hostname())
	if host == "" || strings.HasSuffix(host, ".") || strings.Contains(host, "..") || strings.ContainsAny(host, " /\\%@?#") {
		return "", errInvalidApplication
	}
	ip := net.ParseIP(host)
	if ip == nil {
		for _, character := range host {
			if !(character >= 'a' && character <= 'z' || character >= '0' && character <= '9' || character == '-' || character == '.') {
				return "", errInvalidApplication
			}
		}
		if len(host) > 253 {
			return "", errInvalidApplication
		}
		for _, label := range strings.Split(host, ".") {
			if label == "" || len(label) > 63 || strings.HasPrefix(label, "-") || strings.HasSuffix(label, "-") {
				return "", errInvalidApplication
			}
		}
	}
	port := parsed.Port()
	if port != "" {
		portNumber, err := strconv.Atoi(port)
		if err != nil || portNumber < 1 || portNumber > 65535 {
			return "", errInvalidApplication
		}
	}
	if scheme != "https" {
		local := host == "localhost" || ip != nil && ip.IsLoopback()
		if scheme != "http" || !local {
			return "", errInvalidApplication
		}
	}
	path := parsed.EscapedPath()
	if path == "" {
		path = "/"
	}
	if !strings.HasPrefix(path, "/") || strings.Contains(parsed.Path, "\\") {
		return "", errInvalidApplication
	}
	for _, segment := range strings.Split(parsed.Path, "/") {
		if segment == "." || segment == ".." {
			return "", errInvalidApplication
		}
	}
	if scheme == "https" && port == "443" || scheme == "http" && port == "80" {
		port = ""
	}
	authority := host
	if ip != nil && strings.Contains(host, ":") {
		authority = "[" + host + "]"
	}
	if port != "" {
		authority = net.JoinHostPort(host, port)
	}
	result := scheme + "://" + authority + path
	if parsed.RawQuery != "" {
		result += "?" + parsed.RawQuery
	}
	return result, nil
}

func normalizeCallbackOrigin(value string) (string, error) {
	parsed, err := url.Parse(strings.TrimSpace(value))
	if err != nil || parsed.Opaque != "" || parsed.User != nil || parsed.Host == "" || parsed.RawQuery != "" || parsed.Fragment != "" || (parsed.Path != "" && parsed.Path != "/") {
		return "", errInvalidApplication
	}
	host := strings.ToLower(parsed.Hostname())
	if host == "" || strings.Contains(host, "..") {
		return "", errInvalidApplication
	}
	if parsed.Scheme != "https" {
		ip := net.ParseIP(host)
		local := host == "localhost" || (ip != nil && ip.IsLoopback())
		if parsed.Scheme != "http" || !local {
			return "", errInvalidApplication
		}
	}
	if parsed.Port() != "" {
		if _, err := net.LookupPort("tcp", parsed.Port()); err != nil {
			return "", errInvalidApplication
		}
	}
	return parsed.Scheme + "://" + strings.ToLower(parsed.Host), nil
}
