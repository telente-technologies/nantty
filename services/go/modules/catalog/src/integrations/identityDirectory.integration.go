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
)

type HttpIdentityDirectory struct {
	BaseUrl string
	Token   string
	Client  *http.Client
}

func NewHttpIdentityDirectory(baseUrl, token string) HttpIdentityDirectory {
	return HttpIdentityDirectory{BaseUrl: strings.TrimRight(baseUrl, "/"), Token: token, Client: &http.Client{Timeout: 5 * time.Second}}
}

func (directory HttpIdentityDirectory) UserSummaries(ctx context.Context, accountIds []uuid.UUID) (map[uuid.UUID]map[string]any, error) {
	found := map[uuid.UUID]map[string]any{}
	if directory.BaseUrl == "" || len(accountIds) == 0 {
		return found, nil
	}
	for start := 0; start < len(accountIds); start += 100 {
		batch := accountIds[start:min(start+100, len(accountIds))]
		if err := directory.fetch(ctx, batch, found); err != nil {
			return found, err
		}
	}
	return found, nil
}

func (directory HttpIdentityDirectory) fetch(ctx context.Context, accountIds []uuid.UUID, found map[uuid.UUID]map[string]any) error {
	raw := make([]string, 0, len(accountIds))
	for _, accountId := range accountIds {
		raw = append(raw, accountId.String())
	}
	encoded, _ := json.Marshal(map[string]any{"ids": raw})
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, directory.BaseUrl+"/api/v1/internal/users/summaries", bytes.NewReader(encoded))
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Internal-Token", directory.Token)
	response, err := directory.Client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("user summaries answered %d", response.StatusCode)
	}
	var body struct {
		Data []map[string]any `json:"data"`
	}
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		return err
	}
	for _, summary := range body.Data {
		if raw, ok := summary["id"].(string); ok {
			if accountId, parseError := uuid.Parse(raw); parseError == nil {
				found[accountId] = summary
			}
		}
	}
	return nil
}
