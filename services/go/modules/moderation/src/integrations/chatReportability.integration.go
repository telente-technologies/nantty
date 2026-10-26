package integrations

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"time"

	"github.com/google/uuid"

	"nantty/modules/moderation/src/configs"
	"nantty/platform/httpserver"
)

type ChatReportabilityRequest struct {
	ConversationId string
	ReporterId     string
	ReportedUserId string
	MessageId      string
}

type ChatReportabilityChecker interface {
	RequireReportable(ctx context.Context, request ChatReportabilityRequest) error
}

type HttpChatReportability struct {
	Source       configs.InternalSource
	Configured   bool
	IsProduction bool
	Client       *http.Client
}

func NewHttpChatReportability(sources map[string]configs.InternalSource, isProduction bool) HttpChatReportability {
	source, configured := sources["social"]
	return HttpChatReportability{Source: source, Configured: configured, IsProduction: isProduction, Client: &http.Client{Timeout: 3 * time.Second}}
}

var chatReportabilityUnavailable = httpserver.NewApiError(http.StatusServiceUnavailable, "REPORT_CHECK_UNAVAILABLE", "We couldn't check this conversation right now. Try again.")

func (checker HttpChatReportability) RequireReportable(ctx context.Context, request ChatReportabilityRequest) error {
	if !checker.Configured {
		if checker.IsProduction {
			return chatReportabilityUnavailable
		}
		return nil
	}
	if _, err := uuid.Parse(request.ConversationId); err != nil {
		return httpserver.NewApiError(http.StatusForbidden, "NOT_A_MEMBER", "You can only report conversations you're in.")
	}
	query := url.Values{"reporterId": {request.ReporterId}}
	if request.ReportedUserId != "" {
		query.Set("reportedUserId", request.ReportedUserId)
	}
	if _, err := uuid.Parse(request.MessageId); err == nil {
		query.Set("messageId", request.MessageId)
	}
	target := checker.Source.BaseUrl + "/api/v1/internal/moderation/conversations/" + url.PathEscape(request.ConversationId) + "/reportability?" + query.Encode()
	built, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if err != nil {
		return err
	}
	built.Header.Set("X-Internal-Token", checker.Source.Token)
	response, err := checker.Client.Do(built)
	if err != nil {
		return chatReportabilityUnavailable
	}
	defer response.Body.Close()
	switch {
	case response.StatusCode == http.StatusOK:
		return nil
	case response.StatusCode >= 500:
		return chatReportabilityUnavailable
	}
	var refusal struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	}
	if json.NewDecoder(response.Body).Decode(&refusal) != nil || refusal.Code == "" {
		return httpserver.NewApiError(http.StatusForbidden, "NOT_A_MEMBER", "You can only report conversations you're in.")
	}
	status := response.StatusCode
	if status != http.StatusForbidden && status != http.StatusNotFound && status != http.StatusUnprocessableEntity {
		status = http.StatusForbidden
	}
	return httpserver.NewApiError(status, refusal.Code, refusal.Message)
}
