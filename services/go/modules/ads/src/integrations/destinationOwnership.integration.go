package integrations

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"time"

	adserrors "nantty/modules/ads/src/errors"
	"nantty/modules/ads/src/interfaces"
)

type DenyAllOwnership struct{}

func (DenyAllOwnership) Owns(context.Context, interfaces.OwnershipQuery) (bool, error) {
	return false, nil
}

type AllowAllOwnership struct{}

func (AllowAllOwnership) Owns(context.Context, interfaces.OwnershipQuery) (bool, error) {
	return true, nil
}

type HttpDestinationOwnership struct {
	Social   InternalEndpoint
	Commerce InternalEndpoint
	Identity InternalEndpoint
	Http     *http.Client
}

func (checker HttpDestinationOwnership) endpointFor(kind string) (InternalEndpoint, bool) {
	var endpoint InternalEndpoint
	switch kind {
	case "post", "clip":
		endpoint = checker.Social
	case "product", "store":
		endpoint = checker.Commerce
	case "profile":
		endpoint = checker.Identity
	}
	return endpoint, endpoint.BaseUrl != ""
}

func (checker HttpDestinationOwnership) Owns(ctx context.Context, query interfaces.OwnershipQuery) (bool, error) {
	endpoint, configured := checker.endpointFor(query.Kind)
	if !configured {
		return false, adserrors.UpstreamUnavailable
	}
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	values := url.Values{"ownerUserId": {query.OwnerUserId}}
	if query.StoreId != "" {
		values.Set("storeId", query.StoreId)
	}
	address := endpoint.BaseUrl + "/api/v1/internal/ownership/" + url.PathEscape(query.Kind) + "/" + url.PathEscape(query.TargetId) + "?" + values.Encode()
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, address, nil)
	if err != nil {
		return false, err
	}
	request.Header.Set("X-Internal-Token", endpoint.Token)
	response, err := checker.Http.Do(request)
	if err != nil {
		return false, adserrors.UpstreamUnavailable
	}
	defer response.Body.Close()
	if response.StatusCode == http.StatusNotFound {
		return false, nil
	}
	var body struct {
		Owned bool `json:"owned"`
	}
	if response.StatusCode != http.StatusOK || json.NewDecoder(response.Body).Decode(&body) != nil {
		return false, adserrors.UpstreamUnavailable
	}
	return body.Owned, nil
}
