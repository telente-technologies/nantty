package moderation

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	accesssecurityjobs "zudomart/modules/moderation/src/modules/accessSecurity/jobs"
)

func (harness *moderationHarness) internal(method, path string, body any, want int) map[string]any {
	harness.t.Helper()
	return harness.expect(method, path, "", body, want, "X-Internal-Token", strings.Repeat("m", 32))
}

func (harness *moderationHarness) violation(accountId string, index int) map[string]any {
	return harness.internal("POST", "/api/v1/internal/security/access-violations", map[string]any{
		"violationId": fmt.Sprintf("%s-%d", accountId, index), "accountId": accountId, "deviceId": "device-a", "ipPrefix": "102.89.34.0/24", "kind": "privateNotFound",
		"routeTemplate": "/api/v1/orders/:id", "resourceType": "order", "windowCount": 16, "windowSeconds": 600, "distinctResources": 16, "threshold": 15, "source": "gateway",
	}, 202)
}

func (harness *moderationHarness) challenge(accountId string, attempt int, passed bool) map[string]any {
	return harness.internal("POST", "/api/v1/internal/security/challenges", map[string]any{
		"attemptId": fmt.Sprintf("%s-attempt-%d", accountId, attempt), "accountId": accountId, "deviceId": "device-a", "passed": passed, "provider": "turnstile",
	}, 200)
}

func (harness *moderationHarness) challengeState(accountId string) map[string]any {
	return harness.internal("GET", "/api/v1/internal/security/accounts/"+accountId+"/challenge-state", nil, 200)
}

func (harness *moderationHarness) enforcementActions() []string {
	harness.users.mutex.Lock()
	defer harness.users.mutex.Unlock()
	actions := []string{}
	for _, request := range harness.users.Requests {
		actions = append(actions, request.Action)
	}
	return actions
}

func TestProbingRequiresAChallengeAndPassingClearsIt(t *testing.T) {
	harness := startModerationAgainstFreshSchema(t)
	accountId := uuid.NewString()
	if state := harness.challengeState(accountId); state["requirement"] != "none" {
		t.Fatalf("fresh account requirement = %v", state["requirement"])
	}
	result := harness.violation(accountId, 1)
	if result["requirement"] != "once" || result["caseId"] == nil {
		t.Fatalf("violation result = %v", result)
	}
	harness.violation(accountId, 1)
	if state := harness.challengeState(accountId); state["requirement"] != "once" {
		t.Fatalf("flagged requirement = %v", state["requirement"])
	}
	passed := harness.challenge(accountId, 1, true)
	if passed["requirement"] != "none" || passed["clearedUntil"] == nil {
		t.Fatalf("pass result = %v", passed)
	}
	if state := harness.challengeState(accountId); state["requirement"] != "none" {
		t.Fatalf("cleared requirement = %v", state["requirement"])
	}
	if len(harness.enforcementActions()) != 0 {
		t.Fatalf("no enforcement expected, got %v", harness.enforcementActions())
	}
}

func TestSuspectedBotIsChallengedOnEveryActionEvenAfterPassing(t *testing.T) {
	harness := startModerationAgainstFreshSchema(t)
	accountId := uuid.NewString()
	result := harness.internal("POST", "/api/v1/internal/security/bot-scores", map[string]any{
		"scoreId": "score-1", "accountId": accountId, "score": 0.93, "reasonCodes": []string{"robotic_cadence", "follow_burst"}, "modelVersion": "bot_rules:v1", "advisoryOnly": true,
	}, 200)
	if result["suspectedBot"] != true {
		t.Fatalf("bot score result = %v", result)
	}
	for attempt := range 3 {
		if state := harness.challengeState(accountId); state["requirement"] != "everyAction" {
			t.Fatalf("attempt %d requirement = %v", attempt, state["requirement"])
		}
		if passed := harness.challenge(accountId, attempt, true); passed["requirement"] != "everyAction" {
			t.Fatalf("bots stay challenged after a pass: %v", passed)
		}
	}
	if !harness.waitForPublished("security.botSuspected") {
		t.Fatal("security.botSuspected was not published")
	}
}

func TestFiveFailedChallengesSuspendAutomaticallyButNeverDelete(t *testing.T) {
	harness := startModerationAgainstFreshSchema(t)
	accountId := uuid.NewString()
	harness.violation(accountId, 1)
	for attempt := 1; attempt <= 4; attempt++ {
		if failed := harness.challenge(accountId, attempt, false); failed["suspended"] == true {
			t.Fatalf("suspended after %d failures", attempt)
		}
	}
	if final := harness.challenge(accountId, 5, false); final["suspended"] != true {
		t.Fatalf("fifth failure must suspend: %v", final)
	}
	actions := harness.enforcementActions()
	if len(actions) != 1 || actions[0] != "suspend" {
		t.Fatalf("enforcement actions = %v, want exactly one suspend", actions)
	}
	request := harness.users.last()
	if request.Reason != "Security: repeated unauthorised access attempts" || request.Source != "security" || request.DurationDays == nil || *request.DurationDays != 7 {
		t.Fatalf("suspension request = %+v", request)
	}
	if !harness.waitForPublished("security.accountAutoSuspended") {
		t.Fatal("security.accountAutoSuspended was not published")
	}
	harness.violation(accountId, 2)
	harness.challenge(accountId, 6, false)
	if actions := harness.enforcementActions(); len(actions) != 1 {
		t.Fatalf("automation must stop at suspension, got %v", actions)
	}
	access, stepUp := harness.staff("security:cases")
	list := harness.expect("GET", "/api/v1/admin/security/cases", access, nil, 200)
	cases := list["data"].([]any)
	if len(cases) != 1 || cases[0].(map[string]any)["status"] != "open" || cases[0].(map[string]any)["autoSuspended"] != true {
		t.Fatalf("cases = %v", cases)
	}
	caseId := cases[0].(map[string]any)["id"].(string)
	detail := harness.expect("GET", "/api/v1/admin/security/cases/"+caseId, access, nil, 200)
	if len(detail["challengeHistory"].([]any)) < 6 || len(detail["linkedDevices"].([]any)) != 1 {
		t.Fatalf("detail = %v", detail)
	}
	harness.expect("POST", "/api/v1/admin/security/cases/"+caseId+"/decide", access, map[string]any{"action": "delete", "reason": "Confirmed probing", "confirmUsername": "x"}, 403, stepUp...)
}

func TestContinuedProbingAfterThreeChallengesSuspends(t *testing.T) {
	harness := startModerationAgainstFreshSchema(t)
	accountId := uuid.NewString()
	for index := 1; index <= 3; index++ {
		harness.violation(accountId, index)
		harness.challenge(accountId, index, true)
	}
	if actions := harness.enforcementActions(); len(actions) != 0 {
		t.Fatalf("three challenged violations must not suspend: %v", actions)
	}
	if result := harness.violation(accountId, 4); result["action"] != "suspended" {
		t.Fatalf("fourth violation result = %v", result)
	}
	if actions := harness.enforcementActions(); len(actions) != 1 || actions[0] != "suspend" {
		t.Fatalf("actions = %v", actions)
	}
}

func TestStaffDecisionsNeedStepUpAndTheMatchingPermission(t *testing.T) {
	harness := startModerationAgainstFreshSchema(t)
	accountId := uuid.NewString()
	caseId := harness.violation(accountId, 1)["caseId"].(string)
	access, stepUp := harness.staff("security:cases", "users:delete")
	harness.expect("POST", "/api/v1/admin/security/cases/"+caseId+"/decide", access, map[string]any{"action": "delete", "reason": "Confirmed probing", "confirmUsername": "user"}, 403)
	harness.expect("POST", "/api/v1/admin/security/cases/"+caseId+"/decide", access, map[string]any{"action": "ban", "reason": "Confirmed probing"}, 403, stepUp...)
	decided := harness.expect("POST", "/api/v1/admin/security/cases/"+caseId+"/decide", access, map[string]any{"action": "delete", "reason": "Confirmed probing after review", "confirmUsername": "user"}, 200, stepUp...)
	if decided["status"] != "deleted" || harness.users.last().Action != "delete" || harness.users.last().ConfirmUsername != "user" {
		t.Fatalf("decision = %v, request = %+v", decided, harness.users.last())
	}
	if !harness.audit.has("securityCase.delete") {
		t.Fatal("staff decision was not audited")
	}
	harness.expect("POST", "/api/v1/admin/security/cases/"+caseId+"/decide", access, map[string]any{"action": "clear", "reason": "Second decision"}, 409, stepUp...)
}

func TestSecurityEventsExpireUnlessACaseIsStillOpen(t *testing.T) {
	harness := startModerationAgainstFreshSchema(t)
	openAccount, closedAccount := uuid.NewString(), uuid.NewString()
	harness.violation(openAccount, 1)
	closedCase := harness.violation(closedAccount, 1)["caseId"].(string)
	access, stepUp := harness.staff("security:cases")
	harness.expect("POST", "/api/v1/admin/security/cases/"+closedCase+"/decide", access, map[string]any{"action": "clear", "reason": "False positive"}, 200, stepUp...)
	container := harness.module.Container()
	later := time.Now().Add(400 * 24 * time.Hour)
	if _, err := accesssecurityjobs.PurgeExpiredSecurityEventsBefore(context.Background(), container, later.Add(-365*24*time.Hour)); err != nil {
		t.Fatal(err)
	}
	remaining := func(accountId string) int {
		var count int
		_ = harness.database.QueryRow("SELECT count(*) FROM security_events WHERE account_id = $1", accountId).Scan(&count)
		return count
	}
	if remaining(closedAccount) != 0 || remaining(openAccount) == 0 {
		t.Fatalf("closed=%d open=%d", remaining(closedAccount), remaining(openAccount))
	}
}
