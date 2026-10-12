package integrations

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"zudomart/modules/moderation/src/configs"
	"zudomart/platform/httpserver"
)

const conversationId = "0192f0a0-0000-7000-8000-0000000000d1"

func codeOf(err error) (int, string) {
	var apiError *httpserver.ApiError
	if !errors.As(err, &apiError) {
		return 0, ""
	}
	return apiError.Status, apiError.Code
}

func TestChatReportabilityFailsClosedAndPassesSocialRefusalsThrough(t *testing.T) {
	answers := map[string]func(http.ResponseWriter){
		"member": func(writer http.ResponseWriter) { writer.WriteHeader(http.StatusOK) },
		"outsider": func(writer http.ResponseWriter) {
			httpserver.WriteJsonResponse(writer, http.StatusForbidden, httpserver.NewApiError(http.StatusForbidden, "NOT_A_MEMBER", "no"))
		},
		"broken": func(writer http.ResponseWriter) { writer.WriteHeader(http.StatusBadGateway) },
	}
	var token string
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		token = request.Header.Get("X-Internal-Token")
		answers[request.URL.Query().Get("reporterId")](writer)
	}))
	defer server.Close()
	checker := NewHttpChatReportability(map[string]configs.InternalSource{"social": {BaseUrl: server.URL, Token: "internal-secret"}}, true)
	check := func(reporter string) error {
		return checker.RequireReportable(context.Background(), ChatReportabilityRequest{ConversationId: conversationId, ReporterId: reporter})
	}
	if err := check("member"); err != nil || token != "internal-secret" {
		t.Fatalf("a member may report: %v (token %q)", err, token)
	}
	if status, code := codeOf(check("outsider")); status != http.StatusForbidden || code != "NOT_A_MEMBER" {
		t.Fatalf("a non-member is refused with social's code, got %d %s", status, code)
	}
	if status, _ := codeOf(check("broken")); status != http.StatusServiceUnavailable {
		t.Fatalf("an unavailable social service fails closed, got %d", status)
	}
	if status, code := codeOf(checker.RequireReportable(context.Background(), ChatReportabilityRequest{ConversationId: "conv-1", ReporterId: "member"})); status != http.StatusForbidden || code != "NOT_A_MEMBER" {
		t.Fatalf("a conversation id that cannot exist is refused, got %d %s", status, code)
	}
	unconfigured := NewHttpChatReportability(map[string]configs.InternalSource{}, true)
	if status, _ := codeOf(unconfigured.RequireReportable(context.Background(), ChatReportabilityRequest{ConversationId: conversationId, ReporterId: "member"})); status != http.StatusServiceUnavailable {
		t.Fatalf("production without the social source fails closed, got %d", status)
	}
}
