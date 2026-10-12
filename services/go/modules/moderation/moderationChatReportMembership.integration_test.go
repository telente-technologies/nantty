package moderation

import (
	"context"
	"net/http"
	"testing"

	"zudomart/modules/moderation/src/integrations"
	"zudomart/platform/httpserver"
)

type refusingReportability struct {
	requests []integrations.ChatReportabilityRequest
}

func (checker *refusingReportability) RequireReportable(_ context.Context, request integrations.ChatReportabilityRequest) error {
	checker.requests = append(checker.requests, request)
	return httpserver.NewApiError(http.StatusForbidden, "NOT_A_MEMBER", "You can only report conversations you're in.")
}

func TestChatReportsAreRefusedFromOutsideTheConversation(t *testing.T) {
	harness := startModerationAgainstFreshSchema(t)
	checker := &refusingReportability{}
	harness.module.Container().ChatReportability = checker
	reporterId, token := harness.reporter()
	refused := harness.submit(token, nil, http.StatusForbidden)
	if refused["code"] != "NOT_A_MEMBER" || len(checker.requests) != 1 || checker.requests[0].ReporterId != reporterId || checker.requests[0].ConversationId != "conv-1" {
		t.Fatalf("refusal %v after checks %+v", refused, checker.requests)
	}
	missing := harness.submit(token, map[string]any{"conversationId": ""}, http.StatusBadRequest)
	if missing["code"] != "VALIDATION_FAILED" {
		t.Fatalf("a conversation report without a conversation id: %v", missing)
	}
	count, err := harness.module.Container().Client.ChatReport.Query().Count(context.Background())
	if err != nil || count != 0 {
		t.Fatalf("no case is opened for a refused report: count=%d err=%v", count, err)
	}
}
