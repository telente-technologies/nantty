package integrations

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"time"

	"github.com/google/uuid"
)

type SocialSaveCounts struct {
	BaseUrl string
	Token   string
	Http    *http.Client
}

func NewSocialSaveCounts(baseUrl, token string) SocialSaveCounts {
	return SocialSaveCounts{BaseUrl: baseUrl, Token: token, Http: &http.Client{Timeout: 2 * time.Second}}
}

func (counts SocialSaveCounts) ProductSaveCount(ctx context.Context, productId uuid.UUID) int {
	if counts.BaseUrl == "" {
		return 0
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, counts.BaseUrl+"/api/v1/internal/save-counts?"+url.Values{"type": {"product"}, "ids": {productId.String()}}.Encode(), nil)
	if err != nil {
		return 0
	}
	request.Header.Set("X-Internal-Token", counts.Token)
	response, err := counts.Http.Do(request)
	if err != nil {
		return 0
	}
	defer response.Body.Close()
	var page struct {
		Data []struct {
			SaveCount int `json:"saveCount"`
		} `json:"data"`
	}
	if response.StatusCode != http.StatusOK || json.NewDecoder(response.Body).Decode(&page) != nil || len(page.Data) == 0 {
		return 0
	}
	return page.Data[0].SaveCount
}
