package integrations

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"
)

type SocialStoreFollows struct {
	BaseUrl string
	Token   string
	Http    *http.Client
}

func NewSocialStoreFollows(baseUrl, token string) SocialStoreFollows {
	return SocialStoreFollows{BaseUrl: strings.TrimRight(baseUrl, "/"), Token: token, Http: &http.Client{Timeout: 2 * time.Second}}
}

func (follows SocialStoreFollows) StoreFollowStats(ctx context.Context, storeId uuid.UUID, viewer *uuid.UUID) (int, bool) {
	if follows.BaseUrl == "" {
		return 0, false
	}
	address := follows.BaseUrl + "/api/v1/internal/stores/" + storeId.String() + "/follow-stats"
	if viewer != nil {
		address += "?" + url.Values{"viewerId": {viewer.String()}}.Encode()
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, address, nil)
	if err != nil {
		return 0, false
	}
	request.Header.Set("X-Internal-Token", follows.Token)
	response, err := follows.Http.Do(request)
	if err != nil {
		return 0, false
	}
	defer response.Body.Close()
	var stats struct {
		Followers   int  `json:"followers"`
		IsFollowing bool `json:"isFollowing"`
	}
	if response.StatusCode != http.StatusOK || json.NewDecoder(response.Body).Decode(&stats) != nil {
		return 0, false
	}
	return stats.Followers, stats.IsFollowing
}
