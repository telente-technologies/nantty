package integrations

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"
	"time"

	adserrors "nantty/modules/ads/src/errors"
)

const (
	maximumAudienceMembers = 200_000
	audiencePageSize       = 1000
)

type InternalEndpoint struct {
	BaseUrl string
	Token   string
}

type HttpAudienceSource struct {
	Social   InternalEndpoint
	Commerce InternalEndpoint
	Http     *http.Client
}

func NewHttpAudienceSource(social, commerce InternalEndpoint) HttpAudienceSource {
	return HttpAudienceSource{Social: social, Commerce: commerce, Http: &http.Client{Timeout: 10 * time.Second}}
}

func (source HttpAudienceSource) collect(ctx context.Context, endpoint InternalEndpoint, path string, query url.Values) ([]string, error) {
	if endpoint.BaseUrl == "" {
		return nil, adserrors.UpstreamUnavailable
	}
	members, cursor := []string{}, ""
	for len(members) < maximumAudienceMembers {
		query.Set("limit", strconv.Itoa(audiencePageSize))
		if cursor != "" {
			query.Set("cursor", cursor)
		}
		request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint.BaseUrl+path+"?"+query.Encode(), nil)
		if err != nil {
			return nil, err
		}
		request.Header.Set("X-Internal-Token", endpoint.Token)
		response, err := source.Http.Do(request)
		if err != nil {
			return nil, adserrors.UpstreamUnavailable
		}
		var page struct {
			Data []struct {
				AccountId string `json:"accountId"`
			} `json:"data"`
			NextCursor *string `json:"nextCursor"`
		}
		decodeError := json.NewDecoder(response.Body).Decode(&page)
		_ = response.Body.Close()
		if response.StatusCode != http.StatusOK || decodeError != nil {
			return nil, adserrors.UpstreamUnavailable
		}
		for _, member := range page.Data {
			members = append(members, member.AccountId)
		}
		if page.NextCursor == nil || *page.NextCursor == "" {
			break
		}
		cursor = *page.NextCursor
	}
	return members, nil
}

func (source HttpAudienceSource) StoreCustomers(ctx context.Context, storeId string, retentionDays, minimumOrders int) ([]string, error) {
	return source.collect(ctx, source.Commerce, "/api/v1/internal/audience-sources/stores/"+url.PathEscape(storeId)+"/purchasers",
		url.Values{"retentionDays": {strconv.Itoa(retentionDays)}, "minimumOrders": {strconv.Itoa(max(minimumOrders, 1))}})
}

func (source HttpAudienceSource) Engagers(ctx context.Context, ownerUserId, engagementSource string, retentionDays int) ([]string, error) {
	return source.collect(ctx, source.Social, "/api/v1/internal/audience-sources/accounts/"+url.PathEscape(ownerUserId)+"/engagers",
		url.Values{"source": {engagementSource}, "retentionDays": {strconv.Itoa(retentionDays)}})
}

func (source HttpAudienceSource) Followers(ctx context.Context, ownerUserId string) ([]string, error) {
	return source.collect(ctx, source.Social, "/api/v1/internal/audience-sources/accounts/"+url.PathEscape(ownerUserId)+"/followers", url.Values{})
}
