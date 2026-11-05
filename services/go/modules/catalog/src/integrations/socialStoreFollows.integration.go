package integrations

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"

	catalogerrors "nantty/modules/catalog/src/errors"
)

type SocialStoreFollows struct {
	BaseUrl string
	Token   string
	Http    *http.Client
}

func NewSocialStoreFollows(baseUrl, token string) SocialStoreFollows {
	return SocialStoreFollows{BaseUrl: strings.TrimRight(baseUrl, "/"), Token: token, Http: &http.Client{Timeout: 2 * time.Second}}
}

func (follows SocialStoreFollows) StoreFollowStats(ctx context.Context, storeId uuid.UUID, viewer *uuid.UUID) (int, bool, error) {
	if follows.BaseUrl == "" || follows.Http == nil {
		return 0, false, catalogerrors.StoreFollowStatsUnavailable
	}
	address := follows.BaseUrl + "/api/v1/internal/stores/" + storeId.String() + "/follow-stats"
	if viewer != nil {
		address += "?" + url.Values{"viewerId": {viewer.String()}}.Encode()
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, address, nil)
	if err != nil {
		return 0, false, catalogerrors.StoreFollowStatsUnavailable
	}
	request.Header.Set("X-Internal-Token", follows.Token)
	response, err := follows.Http.Do(request)
	if err != nil {
		return 0, false, catalogerrors.StoreFollowStatsUnavailable
	}
	defer response.Body.Close()
	var stats struct {
		Followers   *int  `json:"followers"`
		IsFollowing *bool `json:"isFollowing"`
	}
	if response.StatusCode != http.StatusOK || json.NewDecoder(response.Body).Decode(&stats) != nil || stats.Followers == nil || stats.IsFollowing == nil || *stats.Followers < 0 {
		return 0, false, catalogerrors.StoreFollowStatsUnavailable
	}
	return *stats.Followers, *stats.IsFollowing, nil
}

func (follows SocialStoreFollows) SetStoreFollow(ctx context.Context, storeId, followerId uuid.UUID, follow bool) (int, bool, error) {
	if follows.BaseUrl == "" || follows.Http == nil || follows.Token == "" {
		return 0, false, catalogerrors.StoreFollowUnavailable
	}
	method := http.MethodDelete
	if follow {
		method = http.MethodPost
	}
	address := follows.BaseUrl + "/api/v1/internal/stores/" + storeId.String() + "/followers/" + followerId.String()
	request, err := http.NewRequestWithContext(ctx, method, address, nil)
	if err != nil {
		return 0, false, catalogerrors.StoreFollowUnavailable
	}
	request.Header.Set("X-Internal-Token", follows.Token)
	response, err := follows.Http.Do(request)
	if err != nil {
		return 0, false, catalogerrors.StoreFollowUnavailable
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		var remote struct {
			Code string `json:"code"`
		}
		_ = json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(&remote)
		if response.StatusCode == http.StatusNotFound || remote.Code == "STORE_NOT_FOUND" {
			return 0, false, catalogerrors.StoreNotFound
		}
		if response.StatusCode == http.StatusConflict && remote.Code == "CANNOT_FOLLOW_OWN" {
			return 0, false, catalogerrors.CannotFollowOwn
		}
		return 0, false, catalogerrors.StoreFollowUnavailable
	}
	var state struct {
		StoreId     string `json:"storeId"`
		IsFollowing *bool  `json:"isFollowing"`
		Followers   *int   `json:"followers"`
	}
	if json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(&state) != nil || state.StoreId != storeId.String() || state.IsFollowing == nil || state.Followers == nil || *state.Followers < 0 || *state.IsFollowing != follow {
		return 0, false, catalogerrors.StoreFollowUnavailable
	}
	return *state.Followers, *state.IsFollowing, nil
}
