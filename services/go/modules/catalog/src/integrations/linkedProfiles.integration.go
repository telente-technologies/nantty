package integrations

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	catalogerrors "nantty/modules/catalog/src/errors"
	"nantty/modules/catalog/src/interfaces"
	"nantty/platform/httpserver"
)

type HttpLinkedProfiles struct {
	BaseUrl    string
	Token      string
	Production bool
	Client     *http.Client
}

func NewHttpLinkedProfiles(baseUrl, token string, production bool) HttpLinkedProfiles {
	return HttpLinkedProfiles{BaseUrl: strings.TrimRight(baseUrl, "/"), Token: token, Production: production, Client: &http.Client{Timeout: 5 * time.Second}}
}

var errRegistryUnavailable = httpserver.NewApiError(http.StatusServiceUnavailable, "PROFILE_REGISTRY_UNAVAILABLE", "We couldn't check your profiles right now. Try again in a moment.")

func (registry HttpLinkedProfiles) disabled() (bool, error) {
	if registry.BaseUrl != "" {
		return false, nil
	}
	if registry.Production {
		return true, errRegistryUnavailable
	}
	return true, nil
}

func (registry HttpLinkedProfiles) Claim(ctx context.Context, accountId uuid.UUID, claim interfaces.LinkedClaim) error {
	return registry.post(ctx, accountId, "claim", claimBody(claim))
}

func (registry HttpLinkedProfiles) Release(ctx context.Context, accountId uuid.UUID, claim interfaces.LinkedClaim) error {
	return registry.post(ctx, accountId, "release", claimBody(claim))
}

func (registry HttpLinkedProfiles) TransferBrand(ctx context.Context, brandId, fromAccountId, toAccountId uuid.UUID) error {
	return registry.post(ctx, toAccountId, "transfer-brand", map[string]any{"brandId": brandId, "fromAccountId": fromAccountId})
}

func (registry HttpLinkedProfiles) StatusOf(ctx context.Context, accountId uuid.UUID, kind string, profileId uuid.UUID) (string, error) {
	if skip, err := registry.disabled(); skip {
		return "active", err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, registry.BaseUrl+"/api/v1/internal/accounts/"+accountId.String()+"/linked-profiles", nil)
	if err != nil {
		return "", err
	}
	var summary struct {
		Items []struct {
			Kind      string `json:"kind"`
			ProfileId string `json:"profileId"`
			Status    string `json:"status"`
		} `json:"items"`
	}
	if err := registry.send(request, &summary); err != nil {
		return "", err
	}
	for _, item := range summary.Items {
		if item.Kind == kind && item.ProfileId == profileId.String() {
			return item.Status, nil
		}
	}
	return "", nil
}

func claimBody(claim interfaces.LinkedClaim) map[string]any {
	body := map[string]any{"kind": claim.Kind, "profileId": claim.ProfileId}
	if claim.StoreId != nil {
		body["storeId"] = claim.StoreId.String()
	}
	return body
}

func (registry HttpLinkedProfiles) post(ctx context.Context, accountId uuid.UUID, action string, body map[string]any) error {
	if skip, err := registry.disabled(); skip {
		return err
	}
	encoded, _ := json.Marshal(body)
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, registry.BaseUrl+"/api/v1/internal/accounts/"+accountId.String()+"/linked-profiles/"+action, bytes.NewReader(encoded))
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", "application/json")
	return registry.send(request, nil)
}

func (registry HttpLinkedProfiles) send(request *http.Request, decoded any) error {
	request.Header.Set("X-Internal-Token", registry.Token)
	response, err := registry.Client.Do(request)
	if err != nil {
		return errRegistryUnavailable
	}
	defer response.Body.Close()
	if response.StatusCode == http.StatusConflict {
		var failure struct {
			Code string `json:"code"`
		}
		_ = json.NewDecoder(response.Body).Decode(&failure)
		return catalogerrors.ProfileLimitFor(failure.Code)
	}
	if response.StatusCode >= 300 {
		return fmt.Errorf("linked profile registry answered %d: %w", response.StatusCode, errRegistryUnavailable)
	}
	if decoded == nil {
		return nil
	}
	return json.NewDecoder(response.Body).Decode(decoded)
}
