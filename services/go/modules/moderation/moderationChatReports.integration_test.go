package moderation

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
)

func (harness *moderationHarness) submit(token string, overrides map[string]any, status int, headers ...string) map[string]any {
	harness.t.Helper()
	reported := uuid.NewString()
	evidence, hash := evidenceFor(reported, 3)
	body := map[string]any{
		"targetType": "conversation", "targetId": "conv-1", "conversationId": "conv-1", "reportedUserId": reported, "reason": "harassment_or_bullying", "details": "Keeps threatening me",
		"blockReportedUser": true, "evidence": json.RawMessage(evidence), "evidenceSelection": "last_messages", "evidenceHash": hash,
	}
	for key, value := range overrides {
		body[key] = value
	}
	return harness.expect("POST", "/api/v1/reports", token, body, status, headers...)
}

func TestChatReportIntakeValidatesPrioritisesAndVerifiesTheEvidenceHash(t *testing.T) {
	harness := startModerationAgainstFreshSchema(t)
	_, token := harness.reporter()
	harness.expect("POST", "/api/v1/reports", "", map[string]any{}, http.StatusUnauthorized)

	harness.submit(token, map[string]any{"evidence": json.RawMessage("[]")}, http.StatusUnprocessableEntity)
	missing := harness.submit(token, map[string]any{"evidence": json.RawMessage("[]"), "evidenceHash": ""}, http.StatusUnprocessableEntity)
	if missing["code"] != "EVIDENCE_REQUIRED" {
		t.Fatalf("unexpected %v", missing)
	}
	needsDetails := harness.submit(token, map[string]any{"reason": "other", "details": "  "}, http.StatusUnprocessableEntity)
	if needsDetails["code"] != "DETAILS_REQUIRED" {
		t.Fatalf("unexpected %v", needsDetails)
	}
	harness.submit(token, map[string]any{"reason": "made_up_reason"}, http.StatusBadRequest)
	harness.submit(token, map[string]any{"targetType": "channel"}, http.StatusBadRequest)

	childSafety := harness.submit(token, map[string]any{"reason": "child_safety"}, http.StatusCreated)
	if childSafety["priority"] != "urgent" || childSafety["status"] != "received" {
		t.Fatalf("child safety reports are urgent: %v", childSafety)
	}
	userReport := harness.submit(token, map[string]any{"targetType": "user", "evidence": json.RawMessage("[]"), "evidenceHash": "", "reason": "spam_or_scam"}, http.StatusCreated)
	if userReport["priority"] != "low" {
		t.Fatalf("unexpected %v", userReport)
	}

	staff, _ := harness.staff("chat-reports:review")
	queue := harness.expect("GET", "/api/v1/admin/chat-reports", staff, nil, http.StatusOK)["data"].([]any)
	if queue[0].(map[string]any)["priority"] != "URGENT" || queue[0].(map[string]any)["reason"] != "CHILD_SAFETY" {
		t.Fatalf("child safety sorts first: %v", queue)
	}
	detail := harness.expect("GET", "/api/v1/admin/chat-reports/"+childSafety["id"].(string), staff, nil, http.StatusOK)
	if detail["isEvidenceHashVerified"] != true || len(detail["transcript"].([]any)) != 3 || detail["transcript"].([]any)[0].(map[string]any)["isReportedUser"] != true || detail["evidenceRetainedUntil"] == nil {
		t.Fatalf("unexpected detail %v", detail)
	}
	tampered := harness.submit(token, map[string]any{"evidenceHash": "deadbeef"}, http.StatusCreated)
	if harness.expect("GET", "/api/v1/admin/chat-reports/"+tampered["id"].(string), staff, nil, http.StatusOK)["isEvidenceHashVerified"] != false {
		t.Fatal("a wrong evidence hash must be flagged")
	}
}

func TestChatReportIdempotencyRateLimitAndReporterList(t *testing.T) {
	harness := startModerationAgainstFreshSchema(t)
	_, token := harness.reporter()
	first := harness.submit(token, nil, http.StatusCreated, "Idempotency-Key", "key-0001-abcdef")
	status, replay, headers := harness.call("POST", "/api/v1/reports", token, map[string]any{
		"targetType": "user", "targetId": "u1", "reportedUserId": uuid.NewString(), "reason": "hate", "details": "", "blockReportedUser": false, "evidence": []any{},
	}, "Idempotency-Key", "key-0001-abcdef")
	if status != http.StatusCreated || replay["id"] != first["id"] || headers.Get("Idempotent-Replayed") != "true" {
		t.Fatalf("a replayed key returns the first report: %d %v", status, replay)
	}
	for range 4 {
		harness.submit(token, nil, http.StatusCreated)
	}
	limited := harness.submit(token, nil, http.StatusTooManyRequests)
	if limited["code"] != "REPORT_RATE_LIMITED" {
		t.Fatalf("five reports per hour: %v", limited)
	}
	mine := harness.expect("GET", "/api/v1/reports/me", token, nil, http.StatusOK)
	items := mine["data"].([]any)
	if len(items) != 5 || mine["nextCursor"] != nil || items[0].(map[string]any)["status"] != "received" {
		t.Fatalf("the reporter sees their own reports in an envelope: %v", mine)
	}
	harness.expect("GET", "/api/v1/reports/me", "", nil, http.StatusUnauthorized)
}

func TestChatReportActionsUseUserActionsPermissionsStepUpAndNotifyTheReporter(t *testing.T) {
	harness := startModerationAgainstFreshSchema(t)
	submit := func(overrides map[string]any) string {
		_, token := harness.reporter()
		return harness.submit(token, overrides, http.StatusCreated)["id"].(string)
	}
	reviewer, _ := harness.staff("chat-reports:review")
	moderator, moderatorStepUp := harness.staff("chat-reports:review", "users:moderate", "users:restrict", "users:suspend", "users:ban")
	legal, legalStepUp := harness.staff("chat-reports:legal")
	act := func(reportId, access string, body map[string]any, want int, headers ...string) map[string]any {
		return harness.expect("POST", "/api/v1/admin/chat-reports/"+reportId+"/actions", access, body, want, headers...)
	}

	dismissed := submit(nil)
	act(dismissed, reviewer, map[string]any{"action": "DISMISS", "reason": "x"}, http.StatusBadRequest)
	act(dismissed, reviewer, map[string]any{"action": "FLY", "reason": "not a real action"}, http.StatusBadRequest)
	result := act(dismissed, reviewer, map[string]any{"action": "DISMISS", "reason": "no violation found"}, http.StatusOK)
	if result["status"] != "DISMISSED" || result["reporterOutcome"] != "NO_VIOLATION" || result["decision"].(map[string]any)["chatAction"] != "DISMISS" {
		t.Fatalf("unexpected %v", result)
	}
	act(dismissed, reviewer, map[string]any{"action": "DISMISS", "reason": "second decision"}, http.StatusConflict)

	restrict := submit(nil)
	act(restrict, reviewer, map[string]any{"action": "RESTRICT_USER", "reason": "abusive messages", "durationDays": 7}, http.StatusForbidden)
	act(restrict, moderator, map[string]any{"action": "RESTRICT_USER", "reason": "abusive messages", "durationDays": 14}, http.StatusOK)
	forwarded := harness.users.last()
	if forwarded.Action != "restrict" || forwarded.Features[0] != "MESSAGING" || *forwarded.DurationDays != 14 || forwarded.Actor.Id == "" {
		t.Fatalf("the report action is wired to the user action: %+v", forwarded)
	}

	suspend := submit(map[string]any{"reason": "fraud_or_payment_scam"})
	act(suspend, moderator, map[string]any{"action": "SUSPEND_USER", "reason": "payment scam in chat"}, http.StatusOK)
	if last := harness.users.last(); last.Action != "suspend" || last.Source != "chat_report" || last.ReasonCode != "FRAUD" {
		t.Fatalf("unexpected %+v", last)
	}

	ban := submit(nil)
	denied := act(ban, moderator, map[string]any{"action": "BAN_USER", "reason": "repeat harassment"}, http.StatusForbidden)
	if denied["code"] != "STEP_UP_REQUIRED" {
		t.Fatalf("banning needs step-up: %v", denied)
	}
	act(ban, moderator, map[string]any{"action": "BAN_USER", "reason": "repeat harassment"}, http.StatusOK, moderatorStepUp...)
	if harness.users.last().Action != "ban" {
		t.Fatal("ban must reach the user service")
	}

	warn := submit(map[string]any{"targetType": "user", "evidence": json.RawMessage("[]"), "evidenceHash": ""})
	act(warn, moderator, map[string]any{"action": "REMOVE_GROUP", "reason": "this is not a group"}, http.StatusForbidden)
	act(warn, moderator, map[string]any{"action": "REMOVE_GROUP", "reason": "this is not a group"}, http.StatusConflict, moderatorStepUp...)
	act(warn, moderator, map[string]any{"action": "WARN_USER", "reason": "first warning"}, http.StatusOK)
	if last := harness.users.last(); last.Action != "warn" || last.Source != "chat_report" || last.CaseId == "" {
		t.Fatalf("a warning goes through the identity warning path: %+v", last)
	}

	noUser := submit(map[string]any{"reportedUserId": nil})
	conflict := act(noUser, moderator, map[string]any{"action": "WARN_USER", "reason": "cannot warn nobody"}, http.StatusConflict)
	if conflict["code"] != "NO_REPORTED_USER" {
		t.Fatalf("unexpected %v", conflict)
	}
	group := submit(map[string]any{"targetType": "group", "targetId": "g1", "conversationId": "g1"})
	act(group, reviewer, map[string]any{"action": "REMOVE_GROUP", "reason": "group for scams"}, http.StatusForbidden, moderatorStepUp...)
	act(group, moderator, map[string]any{"action": "REMOVE_GROUP", "reason": "group for scams"}, http.StatusOK, moderatorStepUp...)

	escalate := submit(map[string]any{"reason": "child_safety"})
	act(escalate, moderator, map[string]any{"action": "ESCALATE_LEGAL", "reason": "needs legal review"}, http.StatusForbidden, moderatorStepUp...)
	escalated := act(escalate, legal, map[string]any{"action": "ESCALATE_LEGAL", "reason": "needs legal review"}, http.StatusOK, legalStepUp...)
	if escalated["status"] != "ESCALATED_LEGAL" || escalated["isLegalReview"] != true || escalated["reporterOutcome"] != nil {
		t.Fatalf("escalation holds the evidence and does not notify the reporter: %v", escalated)
	}
	for _, action := range []string{"chat_report.dismiss", "chat_report.restrict_user", "chat_report.suspend_user", "chat_report.ban_user", "chat_report.warn_user", "chat_report.remove_group", "chat_report.escalate_legal"} {
		if !harness.audit.has(action) {
			t.Fatalf("%s must be audited on the report", action)
		}
	}
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) && !hasEvent(harness, "report.closed") {
		time.Sleep(100 * time.Millisecond)
	}
	if !hasEvent(harness, "report.closed") || !hasEvent(harness, "chatReport.escalatedToLegal") || !hasEvent(harness, "user.warned") || !hasEvent(harness, "chatGroup.removalRequested") {
		t.Fatalf("outcome events missing: %v", harness.publisher.PublishedEventTypes())
	}
}

func hasEvent(harness *moderationHarness, eventType string) bool {
	for _, published := range harness.publisher.PublishedEventTypes() {
		if published == eventType {
			return true
		}
	}
	return false
}

func TestEvidenceRetentionIsConfigurableAndExpiredEvidenceIsPurgedUnlessOnLegalHold(t *testing.T) {
	harness := startModerationAgainstFreshSchema(t)
	_, token := harness.reporter()
	legal, legalStepUp := harness.staff("chat-reports:legal")
	reviewer, _ := harness.staff("chat-reports:review")

	defaults := harness.expect("GET", "/api/v1/admin/chat-reports/retention", reviewer, nil, http.StatusOK)
	if defaults["retentionDays"] != float64(180) || defaults["legalHoldDays"] != float64(730) || defaults["label"] != "LEGAL REVIEW" {
		t.Fatalf("unexpected defaults %v", defaults)
	}
	harness.expect("PUT", "/api/v1/admin/chat-reports/retention", legal, map[string]any{"retentionDays": 90, "reason": "shorter retention"}, http.StatusForbidden)
	harness.expect("PUT", "/api/v1/admin/chat-reports/retention", reviewer, map[string]any{"retentionDays": 90, "reason": "shorter retention"}, http.StatusForbidden, legalStepUp...)
	harness.expect("PUT", "/api/v1/admin/chat-reports/retention", legal, map[string]any{"retentionDays": 10, "reason": "too short to be allowed"}, http.StatusBadRequest, legalStepUp...)
	updated := harness.expect("PUT", "/api/v1/admin/chat-reports/retention", legal, map[string]any{"retentionDays": 90, "reason": "shorter retention"}, http.StatusOK, legalStepUp...)
	if updated["retentionDays"] != float64(90) || !harness.audit.has("chat_reports.retention_changed") {
		t.Fatalf("retention changes are audited: %v", updated)
	}

	expiring := harness.submit(token, nil, http.StatusCreated)["id"].(string)
	held := harness.submit(token, nil, http.StatusCreated)["id"].(string)
	harness.expect("POST", "/api/v1/admin/chat-reports/"+held+"/actions", legal, map[string]any{"action": "ESCALATE_LEGAL", "reason": "legal hold needed"}, http.StatusOK, legalStepUp...)
	if _, err := harness.database.Exec("UPDATE chat_reports SET evidence_retained_until = now() - interval '1 day'"); err != nil {
		t.Fatal(err)
	}
	purger := newPurger(harness)
	if err := purger.RunOnce(t.Context()); err != nil {
		t.Fatal(err)
	}
	if count := harness.expect("GET", "/api/v1/admin/chat-reports/"+expiring, reviewer, nil, http.StatusOK)["transcript"].([]any); len(count) != 0 {
		t.Fatalf("expired evidence is purged: %v", count)
	}
	if kept := harness.expect("GET", "/api/v1/admin/chat-reports/"+held, reviewer, nil, http.StatusOK)["transcript"].([]any); len(kept) == 0 {
		t.Fatal("evidence under legal hold is kept")
	}
}
