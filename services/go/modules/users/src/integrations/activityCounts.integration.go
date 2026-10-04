package integrations

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
)

type HttpActivityCounts struct {
	SocialUrl, SocialToken string
	LiveUrl, LiveToken     string
	Client                 *http.Client
}

func NewHttpActivityCounts(socialUrl, socialToken, liveUrl, liveToken string) HttpActivityCounts {
	return HttpActivityCounts{SocialUrl: socialUrl, SocialToken: socialToken, LiveUrl: liveUrl, LiveToken: liveToken, Client: &http.Client{Timeout: 5 * time.Second}}
}

func (source HttpActivityCounts) fetch(ctx context.Context, baseUrl, token string, accountId uuid.UUID, field string) (*int, error) {
	if baseUrl == "" {
		return nil, nil
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, baseUrl+"/api/v1/internal/accounts/"+accountId.String()+"/activity-counts?sinceDays=365", nil)
	if err != nil {
		return nil, err
	}
	request.Header.Set("X-Internal-Token", token)
	response, err := source.Client.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("activity counts answered %d", response.StatusCode)
	}
	counts := map[string]int{}
	if err := json.NewDecoder(response.Body).Decode(&counts); err != nil {
		return nil, err
	}
	value, ok := counts[field]
	if !ok {
		return nil, nil
	}
	return &value, nil
}

func (source HttpActivityCounts) PostsAndLivesLastYear(ctx context.Context, accountId uuid.UUID) (*int, *int) {
	posts, _ := source.fetch(ctx, source.SocialUrl, source.SocialToken, accountId, "posts")
	lives, _ := source.fetch(ctx, source.LiveUrl, source.LiveToken, accountId, "lives")
	return posts, lives
}
