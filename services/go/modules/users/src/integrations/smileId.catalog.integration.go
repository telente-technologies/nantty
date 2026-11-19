package integrations

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const maximumSmileIdCatalogBytes = 8 << 20
const smileIdCatalogCacheTTL = 5 * time.Minute
const maximumSmileIdCatalogCacheBytes = 8 << 20
const maximumSmileIdCatalogCacheEntries = 16

func (client *SmileIdClient) SupportedDocuments(ctx context.Context, country string) ([]SmileIdDocumentCountry, error) {
	query := url.Values{}
	if country != "" {
		query.Set("country_code", strings.ToUpper(country))
	}
	var response struct {
		Documents []SmileIdDocumentCountry `json:"valid_documents"`
	}
	if err := client.getCatalog(ctx, "/v3/services/supported_documents", query, &response, func() error {
		if response.Documents == nil {
			return errors.New("smile id: document catalog omitted required valid_documents array")
		}
		return nil
	}); err != nil {
		return nil, err
	}
	return response.Documents, nil
}

func (client *SmileIdClient) SupportedKycTypes(ctx context.Context, country string) ([]SmileIdSupportedKycType, error) {
	query := url.Values{}
	if country != "" {
		query.Set("country", strings.ToUpper(country))
	}
	var response struct {
		Types []SmileIdSupportedKycType `json:"id_types"`
	}
	if err := client.getCatalog(ctx, "/v3/services/supported_id_types", query, &response, nil); err != nil {
		return nil, err
	}
	return response.Types, nil
}

func (client *SmileIdClient) getCatalog(ctx context.Context, path string, query url.Values, destination any, validate func() error) error {
	if client == nil || client.Http == nil {
		return ErrSmileIdNotConfigured
	}
	origin, err := smileIdApiOrigin(client.BaseUrl)
	if err != nil {
		return err
	}
	requestUrl := origin + path
	if encoded := query.Encode(); encoded != "" {
		requestUrl += "?" + encoded
	}
	now := time.Now
	if client.Now != nil {
		now = client.Now
	}
	cacheKey := requestUrl
	if body, ok := client.cachedSmileIdCatalog(cacheKey, now()); ok {
		if err := json.Unmarshal(body, destination); err != nil {
			return err
		}
		if validate != nil {
			return validate()
		}
		return nil
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, requestUrl, nil)
	if err != nil {
		return fmt.Errorf("smile id: create catalog request: %w", err)
	}
	response, err := client.doReadWithRetry(request)
	if err != nil {
		return fmt.Errorf("smile id: catalog request failed: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		_, _ = io.Copy(io.Discard, io.LimitReader(response.Body, 4096))
		return fmt.Errorf("smile id: catalog returned status %d", response.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, maximumSmileIdCatalogBytes+1))
	if err != nil {
		return fmt.Errorf("smile id: read catalog response: %w", err)
	}
	if len(body) > maximumSmileIdCatalogBytes {
		return errors.New("smile id: catalog response exceeded size limit")
	}
	if err := json.Unmarshal(body, destination); err != nil {
		return fmt.Errorf("smile id: invalid catalog response: %w", err)
	}
	if validate != nil {
		if err := validate(); err != nil {
			return err
		}
	}
	client.cacheSmileIdCatalog(cacheKey, body, now().Add(smileIdCatalogCacheTTL))
	return nil
}

func (client *SmileIdClient) cachedSmileIdCatalog(key string, now time.Time) ([]byte, bool) {
	client.catalogMu.RLock()
	entry, ok := client.catalogCache[key]
	client.catalogMu.RUnlock()
	if !ok || !now.Before(entry.expiresAt) {
		return nil, false
	}
	return append([]byte(nil), entry.body...), true
}

func (client *SmileIdClient) cacheSmileIdCatalog(key string, body []byte, expiresAt time.Time) {
	if len(body) > maximumSmileIdCatalogCacheBytes {
		return
	}
	client.catalogMu.Lock()
	defer client.catalogMu.Unlock()
	if client.catalogCache == nil {
		client.catalogCache = make(map[string]smileIdCatalogCacheEntry)
	}
	if previous, ok := client.catalogCache[key]; ok {
		client.catalogCacheBytes -= len(previous.body)
		delete(client.catalogCache, key)
	}
	for len(client.catalogCache) >= maximumSmileIdCatalogCacheEntries || client.catalogCacheBytes+len(body) > maximumSmileIdCatalogCacheBytes {
		oldestKey := ""
		var oldestExpiry time.Time
		for candidateKey, candidate := range client.catalogCache {
			if oldestKey == "" || candidate.expiresAt.Before(oldestExpiry) {
				oldestKey = candidateKey
				oldestExpiry = candidate.expiresAt
			}
		}
		if oldestKey == "" {
			return
		}
		client.catalogCacheBytes -= len(client.catalogCache[oldestKey].body)
		delete(client.catalogCache, oldestKey)
	}
	client.catalogCache[key] = smileIdCatalogCacheEntry{body: append([]byte(nil), body...), expiresAt: expiresAt}
	client.catalogCacheBytes += len(body)
}
