package developerapplications

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
)

type authorizedBusinessStore struct {
	StoreID        string `json:"storeId"`
	StoreName      string `json:"storeName"`
	OwnerAccountID string `json:"ownerAccountId"`
	Role           string `json:"role"`
}

func verifyBusinessMessagingStoreAccess(ctx context.Context, baseURL, token string, accountID, storeID uuid.UUID) (authorizedBusinessStore, error) {
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	token = strings.TrimSpace(token)
	if baseURL == "" || token == "" {
		return authorizedBusinessStore{}, errBusinessAuthorizationUnavailable
	}
	body, err := json.Marshal(map[string]string{"accountId": accountID.String(), "storeId": storeID.String()})
	if err != nil {
		return authorizedBusinessStore{}, errBusinessAuthorizationUnavailable
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+"/api/v1/internal/business-messaging/store-access", bytes.NewReader(body))
	if err != nil {
		return authorizedBusinessStore{}, errBusinessAuthorizationUnavailable
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Business-Messaging-Authorization-Token", token)
	client := &http.Client{Timeout: 4 * time.Second, CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse }}
	response, err := client.Do(request)
	if err != nil {
		return authorizedBusinessStore{}, errBusinessAuthorizationUnavailable
	}
	defer response.Body.Close()
	if response.StatusCode == http.StatusForbidden || response.StatusCode == http.StatusNotFound {
		return authorizedBusinessStore{}, errBusinessAuthorizationDenied
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return authorizedBusinessStore{}, fmt.Errorf("%w: commerce returned %d", errBusinessAuthorizationUnavailable, response.StatusCode)
	}
	var store authorizedBusinessStore
	if err := json.NewDecoder(io.LimitReader(response.Body, 4097)).Decode(&store); err != nil || store.StoreID != storeID.String() {
		return authorizedBusinessStore{}, errBusinessAuthorizationUnavailable
	}
	return store, nil
}
