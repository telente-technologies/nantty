package integrations

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"
)

const smileIdEntitlementCacheTTL = 5 * time.Minute

var smileIdCountryCodePattern = regexp.MustCompile(`^[A-Z]{2}$`)
var smileIdTypeCodePattern = regexp.MustCompile(`^[A-Z0-9_]+$`)

func (client *SmileIdClient) EnhancedDocumentEntitlements(ctx context.Context) (map[string][]string, error) {
	if client == nil || client.Http == nil || !smileIdPartnerIdPattern.MatchString(client.PartnerId) || client.ApiKey == "" {
		return nil, ErrSmileIdNotConfigured
	}

	now := time.Now
	if client.Now != nil {
		now = client.Now
	}
	cacheKey := client.BaseUrl + ":" + client.PartnerId + ":enhanced_document_verification"
	if cached, ok := client.cachedSmileIdConfig(cacheKey, now()); ok {
		return cloneSmileIdEntitlements(cached), nil
	}

	var tokenResponse struct {
		Token string `json:"token"`
	}
	if err := client.postV3Multipart(ctx, "/v3/token", map[string]string{"product": "enhanced_document_verification"}, "", &tokenResponse); err != nil {
		return nil, fmt.Errorf("smile id: enhanced-document entitlement token: %w", err)
	}
	if strings.TrimSpace(tokenResponse.Token) == "" {
		return nil, errors.New("smile id: entitlement token response was empty")
	}

	origin, err := smileIdApiOrigin(client.BaseUrl)
	if err != nil {
		return nil, err
	}
	endpoint, err := url.Parse(origin + "/v3/services/config")
	if err != nil {
		return nil, fmt.Errorf("smile id: build entitlement request: %w", err)
	}
	query := endpoint.Query()
	query.Set("product", "enhanced_document_verification")
	endpoint.RawQuery = query.Encode()
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("smile id: build entitlement request: %w", err)
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("smileid-token", tokenResponse.Token)
	request.Header.Set("smileid-partner-id", client.PartnerId)
	request.Header.Set("smileid-source-sdk", "nantty_backend")
	request.Header.Set("smileid-source-sdk-version", "1")
	response, err := client.doReadWithRetry(request)
	if err != nil {
		return nil, fmt.Errorf("smile id: enhanced-document entitlement request failed: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		_, _ = io.Copy(io.Discard, io.LimitReader(response.Body, 4096))
		return nil, fmt.Errorf("smile id: enhanced-document entitlement request returned status %d", response.StatusCode)
	}
	const maxSmileIdConfigBytes = 1 << 20
	body, err := io.ReadAll(io.LimitReader(response.Body, maxSmileIdConfigBytes+1))
	if err != nil {
		return nil, fmt.Errorf("smile id: read enhanced-document entitlement response: %w", err)
	}
	if len(body) > maxSmileIdConfigBytes {
		return nil, errors.New("smile id: enhanced-document entitlement response exceeded size limit")
	}
	var config struct {
		IDSelection map[string]map[string][]string `json:"idSelection"`
	}
	if err := json.Unmarshal(body, &config); err != nil {
		return nil, fmt.Errorf("smile id: invalid enhanced-document entitlement response: %w", err)
	}
	if config.IDSelection == nil {
		return nil, errors.New("smile id: entitlement response omitted idSelection")
	}
	entitlements, ok := config.IDSelection["enhanced_document_verification"]
	if !ok {
		entitlements = map[string][]string{}
	}
	validated, err := validateSmileIdEntitlements(entitlements)
	if err != nil {
		return nil, err
	}
	client.cacheSmileIdConfig(cacheKey, validated, now().Add(smileIdEntitlementCacheTTL))
	return cloneSmileIdEntitlements(validated), nil
}

func validateSmileIdEntitlements(values map[string][]string) (map[string][]string, error) {
	validated := make(map[string][]string, len(values))
	for country, types := range values {
		country = strings.ToUpper(strings.TrimSpace(country))
		if !smileIdCountryCodePattern.MatchString(country) {
			return nil, errors.New("smile id: entitlement response contained an invalid country code")
		}
		validatedTypes := make([]string, 0, len(types))
		seen := make(map[string]struct{}, len(types))
		for _, idType := range types {
			idType = strings.ToUpper(strings.TrimSpace(idType))
			if !smileIdTypeCodePattern.MatchString(idType) {
				return nil, errors.New("smile id: entitlement response contained an invalid ID type")
			}
			if _, exists := seen[idType]; exists {
				continue
			}
			seen[idType] = struct{}{}
			validatedTypes = append(validatedTypes, idType)
		}
		validated[country] = validatedTypes
	}
	return validated, nil
}

func (client *SmileIdClient) cachedSmileIdConfig(key string, now time.Time) (map[string][]string, bool) {
	client.configMu.RLock()
	entry, ok := client.configCache[key]
	client.configMu.RUnlock()
	if !ok || !now.Before(entry.expiresAt) {
		return nil, false
	}
	return entry.value, true
}

func (client *SmileIdClient) cacheSmileIdConfig(key string, value map[string][]string, expiresAt time.Time) {
	client.configMu.Lock()
	defer client.configMu.Unlock()
	if client.configCache == nil {
		client.configCache = make(map[string]smileIdConfigCacheEntry)
	}
	client.configCache[key] = smileIdConfigCacheEntry{value: cloneSmileIdEntitlements(value), expiresAt: expiresAt}
}

func cloneSmileIdEntitlements(source map[string][]string) map[string][]string {
	clone := make(map[string][]string, len(source))
	for country, types := range source {
		clone[country] = append([]string(nil), types...)
	}
	return clone
}
