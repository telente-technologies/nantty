package integrations

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"strings"

	"github.com/google/uuid"
)

type UsernameResolver interface {
	AccountIdForUsername(ctx context.Context, username string) (uuid.UUID, bool)
}

func ResolveUsername(ctx context.Context, users UsersService, search string) (uuid.UUID, bool) {
	username, isHandle := strings.CutPrefix(strings.TrimSpace(search), "@")
	resolver, canResolve := users.(UsernameResolver)
	if !isHandle || !canResolve || username == "" || len(username) > 64 {
		return uuid.UUID{}, false
	}
	return resolver.AccountIdForUsername(ctx, username)
}

func (service HttpUsersService) AccountIdForUsername(ctx context.Context, username string) (uuid.UUID, bool) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, service.BaseUrl+"/api/v1/internal/users/by-username/"+url.PathEscape(strings.ToLower(username))+"/notification-recipient", nil)
	if err != nil {
		return uuid.UUID{}, false
	}
	request.Header.Set("X-Internal-Token", service.Token)
	response, err := service.Client.Do(request)
	if err != nil {
		return uuid.UUID{}, false
	}
	defer response.Body.Close()
	var body struct {
		AccountId string `json:"accountId"`
	}
	if response.StatusCode != http.StatusOK || json.NewDecoder(response.Body).Decode(&body) != nil {
		return uuid.UUID{}, false
	}
	identifier, err := uuid.Parse(body.AccountId)
	return identifier, err == nil
}
