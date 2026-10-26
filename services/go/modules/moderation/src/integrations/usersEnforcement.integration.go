package integrations

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"github.com/google/uuid"

	"nantty/platform/httpserver"
)

type StaffActor struct {
	Id        string `json:"id"`
	Name      string `json:"name"`
	Role      string `json:"role"`
	IpAddress string `json:"ipAddress"`
	RequestId string `json:"requestId"`
	StepUp    bool   `json:"stepUp"`
}

type EnforcementRequest struct {
	Action          string     `json:"action"`
	UserId          string     `json:"userId"`
	Actor           StaffActor `json:"actor"`
	Reason          string     `json:"reason"`
	Features        []string   `json:"features,omitempty"`
	DurationDays    *int       `json:"durationDays,omitempty"`
	ReasonCode      string     `json:"reasonCode,omitempty"`
	Source          string     `json:"source,omitempty"`
	CaseId          string     `json:"caseId,omitempty"`
	ConfirmUsername string     `json:"confirmUsername,omitempty"`
}

type UserSummary = map[string]any

type UsersService interface {
	Enforce(ctx context.Context, request EnforcementRequest) error
	Summaries(ctx context.Context, ids []uuid.UUID) (map[string]UserSummary, error)
}

type HttpUsersService struct {
	BaseUrl string
	Token   string
	Client  *http.Client
}

func NewHttpUsersService(baseUrl, token string) HttpUsersService {
	return HttpUsersService{BaseUrl: baseUrl, Token: token, Client: &http.Client{Timeout: 10 * time.Second}}
}

func (service HttpUsersService) post(ctx context.Context, path string, body any, destination any) error {
	encoded, err := json.Marshal(body)
	if err != nil {
		return err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, service.BaseUrl+path, bytes.NewReader(encoded))
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Internal-Token", service.Token)
	if token := StepUpTokenFromContext(ctx); token != "" {
		request.Header.Set("X-Step-Up-Token", token)
	}
	response, err := service.Client.Do(request)
	if err != nil {
		return httpserver.NewApiError(http.StatusBadGateway, "UPSTREAM_UNAVAILABLE", "The account service is unavailable. Try again.")
	}
	defer response.Body.Close()
	if response.StatusCode >= 300 {
		var failure httpserver.ApiError
		_ = json.NewDecoder(response.Body).Decode(&failure)
		if failure.Code == "" {
			failure.Code, failure.Message = "UPSTREAM_ERROR", fmt.Sprintf("The account service answered %d.", response.StatusCode)
		}
		failure.Status = response.StatusCode
		return &failure
	}
	if destination == nil {
		return nil
	}
	return json.NewDecoder(response.Body).Decode(destination)
}

func (service HttpUsersService) Enforce(ctx context.Context, request EnforcementRequest) error {
	return service.post(ctx, "/api/v1/internal/enforcement/actions", request, nil)
}

func (service HttpUsersService) Summaries(ctx context.Context, ids []uuid.UUID) (map[string]UserSummary, error) {
	raw := make([]string, 0, len(ids))
	for _, identifier := range ids {
		raw = append(raw, identifier.String())
	}
	var response struct {
		Data []UserSummary `json:"data"`
	}
	if err := service.post(ctx, "/api/v1/internal/users/summaries", map[string]any{"ids": raw}, &response); err != nil {
		return nil, err
	}
	byId := map[string]UserSummary{}
	for _, summary := range response.Data {
		if identifier, ok := summary["id"].(string); ok {
			byId[identifier] = summary
		}
	}
	return byId, nil
}

type AuditRecord struct {
	ActorId        string          `json:"actorId"`
	ActorName      string          `json:"actorName"`
	ActorRole      string          `json:"actorRole"`
	Action         string          `json:"action"`
	SubjectType    string          `json:"subjectType"`
	SubjectId      string          `json:"subjectId"`
	SubjectLabel   string          `json:"subjectLabel"`
	Before         json.RawMessage `json:"before,omitempty"`
	After          json.RawMessage `json:"after,omitempty"`
	Reason         string          `json:"reason"`
	IpAddress      string          `json:"ipAddress"`
	RequestId      string          `json:"requestId"`
	StepUpVerified bool            `json:"stepUpVerified"`
}

type AuditService interface {
	Record(ctx context.Context, record AuditRecord) error
	History(ctx context.Context, subjectType, subjectId string) ([]json.RawMessage, error)
}

type HttpAuditService struct {
	HttpUsersService
}

func NewHttpAuditService(baseUrl, token string) HttpAuditService {
	return HttpAuditService{HttpUsersService: NewHttpUsersService(baseUrl, token)}
}

func (service HttpAuditService) Record(ctx context.Context, record AuditRecord) error {
	return service.post(ctx, "/api/v1/internal/audit/events", record, nil)
}

func (service HttpAuditService) History(ctx context.Context, subjectType, subjectId string) ([]json.RawMessage, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, service.BaseUrl+"/api/v1/internal/audit/history?subjectType="+url.QueryEscape(subjectType)+"&subjectId="+url.QueryEscape(subjectId), nil)
	if err != nil {
		return nil, err
	}
	request.Header.Set("X-Internal-Token", service.Token)
	response, err := service.Client.Do(request)
	if err != nil {
		return []json.RawMessage{}, nil
	}
	defer response.Body.Close()
	var body struct {
		Data []json.RawMessage `json:"data"`
	}
	if response.StatusCode != http.StatusOK || json.NewDecoder(response.Body).Decode(&body) != nil {
		return []json.RawMessage{}, nil
	}
	return body.Data, nil
}
