package moderation

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"

	"zudomart/modules/moderation/src/modules/chatReports/services"
	suspensioncases "zudomart/modules/moderation/src/modules/suspensionCases"
	suspensionservices "zudomart/modules/moderation/src/modules/suspensionCases/services"
	platformevents "zudomart/platform/events"
)

func newPurger(harness *moderationHarness) services.EvidencePurger {
	return services.EvidencePurger{Container: harness.module.Container()}
}

var intakeToken = []string{"X-Internal-Token", strings.Repeat("m", 32)}

func advisoryCase(accountId, reference string) map[string]any {
	return map[string]any{
		"accountId": accountId, "source": "python_suggestion", "riskScore": 91, "topSignals": []string{"burst_follows"}, "reportCount": 0, "modelVersion": "risk-2026-10",
		"signals":           []any{map[string]any{"label": "burst_follows", "weight": 0.6, "detail": "40 follows in 10 minutes"}},
		"externalReference": reference,
	}
}

func TestSuspensionCasesAreAdvisoryAndOnlyAnAdminApprovalSuspends(t *testing.T) {
	harness := startModerationAgainstFreshSchema(t)
	account := uuid.NewString()
	harness.expect("POST", "/api/v1/internal/suspension-cases", "", advisoryCase(account, "ref-1"), http.StatusUnauthorized)
	created := harness.expect("POST", "/api/v1/internal/suspension-cases", "", advisoryCase(account, "ref-1"), http.StatusCreated, intakeToken...)
	replay := harness.expect("POST", "/api/v1/internal/suspension-cases", "", advisoryCase(account, "ref-1"), http.StatusCreated, intakeToken...)
	if created["id"] != replay["id"] {
		t.Fatalf("the same external reference is one case: %v %v", created, replay)
	}
	if len(harness.users.Requests) != 0 {
		t.Fatal("an advisory suggestion must never suspend anyone")
	}
	harness.expect("POST", "/api/v1/internal/suspension-cases", "", map[string]any{"accountId": account, "source": "magic", "riskScore": 10}, http.StatusBadRequest, intakeToken...)

	viewer, _ := harness.staff("users:suspend")
	nobody, _ := harness.staff("metrics:read")
	harness.expect("GET", "/api/v1/admin/suspensions/cases", nobody, nil, http.StatusForbidden)
	queue := harness.expect("GET", "/api/v1/admin/suspensions/cases", viewer, nil, http.StatusOK)["data"].([]any)
	if len(queue) != 1 || queue[0].(map[string]any)["source"] != "PYTHON_SUGGESTION" || queue[0].(map[string]any)["riskScore"] != float64(91) {
		t.Fatalf("unexpected queue %v", queue)
	}
	caseId := created["id"].(string)
	detail := harness.expect("GET", "/api/v1/admin/suspensions/cases/"+caseId, viewer, nil, http.StatusOK)
	if len(detail["signals"].([]any)) != 1 || detail["modelVersion"] != "risk-2026-10" {
		t.Fatalf("unexpected detail %v", detail)
	}

	approverToken, approverStepUp := harness.staff("users:suspend")
	approve := "/api/v1/admin/suspensions/cases/" + caseId + "/approve"
	harness.expect("POST", approve, approverToken, map[string]string{"reasonCode": "FRAUD", "reason": "fake follower farm"}, http.StatusForbidden)
	harness.expect("POST", approve, approverToken, map[string]string{"reasonCode": "NOPE", "reason": "fake follower farm"}, http.StatusBadRequest, approverStepUp...)
	escalated := harness.expect("POST", "/api/v1/admin/suspensions/cases/"+caseId+"/escalate", approverToken, map[string]string{"reason": "needs a second opinion"}, http.StatusOK, approverStepUp...)
	if escalated["status"] != "ESCALATED" || escalated["escalated"] != true {
		t.Fatalf("an escalated case stays open and flagged: %v", escalated)
	}
	approved := harness.expect("POST", approve, approverToken, map[string]string{"reasonCode": "FRAUD", "reason": "fake follower farm"}, http.StatusOK, approverStepUp...)
	if approved["status"] != "SUSPENDED" || approved["decision"].(map[string]any)["outcome"] != "SUSPENDED" {
		t.Fatalf("unexpected %v", approved)
	}
	forwarded := harness.users.last()
	if forwarded.Action != "suspend" || forwarded.CaseId != caseId || forwarded.UserId != account || forwarded.Source != "python_suggestion" {
		t.Fatalf("approval asks the user service to suspend with the case id: %+v", forwarded)
	}
	conflict := harness.expect("POST", "/api/v1/admin/suspensions/cases/"+caseId+"/dismiss", approverToken, map[string]string{"reason": "changed my mind"}, http.StatusConflict, approverStepUp...)
	if conflict["code"] != "CASE_ALREADY_DECIDED" || !harness.audit.has("suspension.approved") {
		t.Fatalf("unexpected %v", conflict)
	}
	if open := harness.expect("GET", "/api/v1/admin/suspensions/cases", viewer, nil, http.StatusOK)["data"].([]any); len(open) != 0 {
		t.Fatalf("decided cases leave the open queue: %v", open)
	}
	if decided := harness.expect("GET", "/api/v1/admin/suspensions/cases?status=DECIDED", viewer, nil, http.StatusOK)["data"].([]any); len(decided) != 1 {
		t.Fatalf("unexpected decided list %v", decided)
	}
}

func TestAdvisoryQueueMessagesBecomeCasesAndNeverSuspend(t *testing.T) {
	harness := startModerationAgainstFreshSchema(t)
	handler := suspensionservices.HandleAdvisoryMessage(harness.module.Container())
	account := uuid.NewString()
	message, _ := json.Marshal(map[string]any{
		"suggestionId": "sg-1", "subjectType": "account", "subjectId": account, "source": "chat_spam", "score": 0.93,
		"evidence": []map[string]any{{"code": "link_spam", "weight": 0.2}, {"code": "burst_dm", "weight": 0.7}}, "advisoryOnly": true, "generatedAt": "2026-10-03T10:00:00Z",
	})
	for range 2 {
		if err := handler(context.Background(), message); err != nil {
			t.Fatal(err)
		}
	}
	notAdvisory, _ := json.Marshal(map[string]any{"suggestionId": "sg-2", "subjectType": "account", "subjectId": account, "source": "x", "score": 0.9, "evidence": []any{}, "advisoryOnly": false, "generatedAt": "2026-10-03T10:00:00Z"})
	if err := handler(context.Background(), notAdvisory); err != nil {
		t.Fatal("non-advisory messages are dropped without retrying")
	}
	if err := handler(context.Background(), []byte("not json")); !errors.Is(err, platformevents.ErrPoisonMessage) {
		t.Fatal("malformed messages are poison and go to the dead-letter queue")
	}
	viewer, _ := harness.staff("users:suspend")
	queue := harness.expect("GET", "/api/v1/admin/suspensions/cases", viewer, nil, http.StatusOK)["data"].([]any)
	if len(queue) != 1 || queue[0].(map[string]any)["riskScore"] != float64(93) || queue[0].(map[string]any)["topSignals"].([]any)[0] != "burst_dm" {
		t.Fatalf("one advisory case per suggestion id, highest weight first: %v", queue)
	}
	if len(harness.users.Requests) != 0 {
		t.Fatal("consuming the advisory queue must never suspend")
	}
	if suspensioncases.QueueNameForTests("https://sqs.eu-west-1.amazonaws.com/000000000000/intelligence-trust-advisory") != "intelligence-trust-advisory" {
		t.Fatal("the queue name comes from the queue URL")
	}
}
