package integrations

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"time"

	"zudomart/platform/staffaudit"
)

var ErrAuditUnavailable = errors.New("staff audit is not configured")

type HttpAuditTrail struct {
	BaseUrl string
	Token   string
	Client  *http.Client
}

func NewHttpAuditTrail(baseUrl, token string) HttpAuditTrail {
	return HttpAuditTrail{BaseUrl: strings.TrimRight(baseUrl, "/"), Token: token, Client: &http.Client{Timeout: 3 * time.Second}}
}

func (trail HttpAuditTrail) Record(ctx context.Context, record staffaudit.Record) error {
	if trail.BaseUrl == "" {
		return ErrAuditUnavailable
	}
	return staffaudit.HttpRecorder{BaseUrl: trail.BaseUrl, Token: trail.Token, Client: trail.Client}.Record(ctx, record)
}

func (trail HttpAuditTrail) History(ctx context.Context, subjectType, subjectId string) ([]json.RawMessage, error) {
	if trail.BaseUrl == "" {
		return []json.RawMessage{}, nil
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, trail.BaseUrl+"/api/v1/internal/audit/history?subjectType="+url.QueryEscape(subjectType)+"&subjectId="+url.QueryEscape(subjectId), nil)
	if err != nil {
		return nil, err
	}
	request.Header.Set("X-Internal-Token", trail.Token)
	response, err := trail.Client.Do(request)
	if err != nil {
		return []json.RawMessage{}, nil
	}
	defer response.Body.Close()
	var body struct {
		Data []json.RawMessage `json:"data"`
	}
	if response.StatusCode != http.StatusOK || json.NewDecoder(response.Body).Decode(&body) != nil || body.Data == nil {
		return []json.RawMessage{}, nil
	}
	return body.Data, nil
}
