package integrations

import (
	"errors"
	"net/url"
)

func smileIdApiOrigin(value string) (string, error) {
	parsed, err := url.Parse(value)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.Hostname() == "" || parsed.User != nil ||
		parsed.Opaque != "" || parsed.RawQuery != "" || parsed.ForceQuery || parsed.Fragment != "" || parsed.RawFragment != "" || parsed.RawPath != "" {
		return "", errors.New("smile id: base URL must be an HTTPS API origin")
	}
	if parsed.Path != "" && parsed.Path != "/" && parsed.Path != "/v1" && parsed.Path != "/v1/" {
		return "", errors.New("smile id: base URL must not include an API path")
	}
	return parsed.Scheme + "://" + parsed.Host, nil
}
