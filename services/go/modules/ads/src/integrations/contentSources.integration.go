package integrations

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"
	"time"

	adserrors "zudomart/modules/ads/src/errors"
	"zudomart/modules/ads/src/interfaces"
)

type NoContentSourceDirectory struct{}

func (NoContentSourceDirectory) ListContentSources(context.Context, interfaces.ContentSourceQuery) ([]map[string]any, string, error) {
	return []map[string]any{}, "", nil
}

// HttpContentSourceDirectory reads boostable content from social's internal API:
// GET {base}/internal/v1/social/ad-content-sources?ownerUserId=&storeId=&type=&search=&cursor=&limit=
// signed with the shared-secret HMAC scheme (v1\nGET\n<path?query>\n<timestamp>\n<nonce>\n<sha256(body)>) and answering
// {data: ContentSource[], nextCursor}, where each item already carries eligible and ineligibleReason.
type HttpContentSourceDirectory struct {
	BaseUrl string
	Secret  string
	Timeout time.Duration
	Http    *http.Client
	Now     func() time.Time
}

func (directory HttpContentSourceDirectory) ListContentSources(ctx context.Context, query interfaces.ContentSourceQuery) ([]map[string]any, string, error) {
	values := url.Values{"ownerUserId": {query.OwnerUserId}, "limit": {strconv.Itoa(query.Limit)}}
	for name, value := range map[string]string{"storeId": query.StoreId, "type": query.Type, "search": query.Search, "cursor": query.Cursor} {
		if value != "" {
			values.Set(name, value)
		}
	}
	const path = "/internal/v1/social/ad-content-sources"
	ctx, cancel := context.WithTimeout(ctx, directory.Timeout)
	defer cancel()
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, directory.BaseUrl+path+"?"+values.Encode(), nil)
	if err != nil {
		return nil, "", err
	}
	nonce := make([]byte, 16)
	_, _ = rand.Read(nonce)
	timestamp, nonceText, emptyBody := strconv.FormatInt(directory.Now().Unix(), 10), hex.EncodeToString(nonce), sha256.Sum256(nil)
	mac := hmac.New(sha256.New, []byte(directory.Secret))
	mac.Write([]byte("v1\nGET\n" + path + "?" + values.Encode() + "\n" + timestamp + "\n" + nonceText + "\n" + hex.EncodeToString(emptyBody[:])))
	request.Header.Set("x-zudo-timestamp", timestamp)
	request.Header.Set("x-zudo-nonce", nonceText)
	request.Header.Set("x-zudo-signature", "v1="+hex.EncodeToString(mac.Sum(nil)))
	response, err := directory.Http.Do(request)
	if err != nil {
		return nil, "", adserrors.UpstreamUnavailable
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, "", adserrors.UpstreamUnavailable
	}
	var page struct {
		Data       []map[string]any `json:"data"`
		NextCursor string           `json:"nextCursor"`
	}
	if err := json.NewDecoder(response.Body).Decode(&page); err != nil {
		return nil, "", adserrors.UpstreamUnavailable
	}
	if page.Data == nil {
		page.Data = []map[string]any{}
	}
	return page.Data, page.NextCursor, nil
}
