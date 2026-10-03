package integrations

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"zudomart/modules/moderation/src/configs"
)

type TargetPreview struct {
	OwnerId    string   `json:"ownerId"`
	Title      *string  `json:"title"`
	Text       *string  `json:"text"`
	MediaUrls  []string `json:"mediaUrls"`
	SoundTitle *string  `json:"soundTitle"`
	CreatedAt  string   `json:"createdAt"`
}

type TargetResolver interface {
	Resolve(ctx context.Context, targetType, targetId string) (*TargetPreview, error)
}

type HttpTargetResolver struct {
	Sources map[string]configs.InternalSource
	Client  *http.Client
}

func NewHttpTargetResolver(sources map[string]configs.InternalSource) HttpTargetResolver {
	return HttpTargetResolver{Sources: sources, Client: &http.Client{Timeout: 3 * time.Second}}
}

var ownerServiceByTargetType = map[string]string{
	"post": "social", "comment": "social", "clip": "social", "sound": "social", "user": "social", "product": "commerce", "store": "commerce", "live": "live",
}

func (resolver HttpTargetResolver) Resolve(ctx context.Context, targetType, targetId string) (*TargetPreview, error) {
	source, configured := resolver.Sources[ownerServiceByTargetType[targetType]]
	if !configured {
		return nil, nil
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, source.BaseUrl+"/api/v1/internal/moderation/targets/"+url.PathEscape(targetType)+"/"+url.PathEscape(targetId), nil)
	if err != nil {
		return nil, err
	}
	request.Header.Set("X-Internal-Token", source.Token)
	response, err := resolver.Client.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if response.StatusCode == http.StatusNotFound || response.StatusCode == http.StatusGone {
		return nil, nil
	}
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("target service answered %d", response.StatusCode)
	}
	var preview TargetPreview
	if err := json.NewDecoder(response.Body).Decode(&preview); err != nil {
		return nil, err
	}
	return &preview, nil
}

type NoTargetResolver struct{}

func (NoTargetResolver) Resolve(context.Context, string, string) (*TargetPreview, error) {
	return nil, nil
}
