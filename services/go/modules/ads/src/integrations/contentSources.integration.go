package integrations

import (
	"context"
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

type HttpContentSourceDirectory struct {
	BaseUrl string
	Token   string
	Timeout time.Duration
	Http    *http.Client
}

func (directory HttpContentSourceDirectory) ListContentSources(ctx context.Context, query interfaces.ContentSourceQuery) ([]map[string]any, string, error) {
	values := url.Values{"ownerUserId": {query.OwnerUserId}, "limit": {strconv.Itoa(query.Limit)}}
	for name, value := range map[string]string{"storeId": query.StoreId, "type": query.Type, "search": query.Search, "cursor": query.Cursor} {
		if value != "" {
			values.Set(name, value)
		}
	}
	ctx, cancel := context.WithTimeout(ctx, directory.Timeout)
	defer cancel()
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, directory.BaseUrl+"/api/v1/internal/ad-sources/content?"+values.Encode(), nil)
	if err != nil {
		return nil, "", err
	}
	request.Header.Set("X-Internal-Token", directory.Token)
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
		NextCursor *string          `json:"nextCursor"`
	}
	if err := json.NewDecoder(response.Body).Decode(&page); err != nil {
		return nil, "", adserrors.UpstreamUnavailable
	}
	if page.Data == nil {
		page.Data = []map[string]any{}
	}
	next := ""
	if page.NextCursor != nil {
		next = *page.NextCursor
	}
	return page.Data, next, nil
}
