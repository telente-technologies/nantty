package integrations

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

type HttpAuditHistory struct {
	BaseUrl string
	Token   string
	Http    *http.Client
}

func (reader HttpAuditHistory) ListHistory(ctx context.Context, subjectType, subjectId string) ([]json.RawMessage, error) {
	if reader.BaseUrl == "" {
		return []json.RawMessage{}, nil
	}
	query := url.Values{"subjectType": {subjectType}, "subjectId": {subjectId}}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimRight(reader.BaseUrl, "/")+"/api/v1/internal/audit/history?"+query.Encode(), nil)
	if err != nil {
		return nil, err
	}
	request.Header.Set("X-Internal-Token", reader.Token)
	var page struct {
		Data []json.RawMessage `json:"data"`
	}
	if err := sendJson(reader.Http, request, &page); err != nil {
		return nil, err
	}
	if page.Data == nil {
		page.Data = []json.RawMessage{}
	}
	return page.Data, nil
}

type HttpPlatformUserSummaries struct {
	BaseUrl string
	Token   string
	Http    *http.Client
}

func (directory HttpPlatformUserSummaries) LookupSummaries(ctx context.Context, ids []string) (map[string]json.RawMessage, error) {
	found := map[string]json.RawMessage{}
	if directory.BaseUrl == "" || len(ids) == 0 {
		return found, nil
	}
	body, _ := json.Marshal(map[string]any{"ids": ids})
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(directory.BaseUrl, "/")+"/api/v1/internal/users/summaries", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Internal-Token", directory.Token)
	var page struct {
		Data []json.RawMessage `json:"data"`
	}
	if err := sendJson(directory.Http, request, &page); err != nil {
		return nil, err
	}
	for _, raw := range page.Data {
		var identified struct {
			Id string `json:"id"`
		}
		if json.Unmarshal(raw, &identified) == nil && identified.Id != "" {
			found[identified.Id] = raw
		}
	}
	return found, nil
}

func sendJson(client *http.Client, request *http.Request, destination any) error {
	response, err := client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode >= 300 {
		return fmt.Errorf("%s returned %d", request.URL.Path, response.StatusCode)
	}
	return json.NewDecoder(response.Body).Decode(destination)
}
