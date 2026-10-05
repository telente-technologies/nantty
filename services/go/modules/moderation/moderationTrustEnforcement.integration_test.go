package moderation

import (
	"context"
	"encoding/json"
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/moderation/src/integrations"
	contentreports "zudomart/modules/moderation/src/modules/contentReports"
	platformevents "zudomart/platform/events"
)

type fakeTargets struct {
	mutex   sync.Mutex
	owners  map[string]string
	missing map[string]bool
}

func (targets *fakeTargets) own(targetType, targetId, owner string) {
	targets.mutex.Lock()
	defer targets.mutex.Unlock()
	targets.owners[targetType+":"+targetId] = owner
}

func (targets *fakeTargets) Resolve(_ context.Context, targetType, targetId string) (*integrations.TargetPreview, error) {
	targets.mutex.Lock()
	defer targets.mutex.Unlock()
	owner, found := targets.owners[targetType+":"+targetId]
	if targets.missing[targetType+":"+targetId] {
		return nil, integrations.ErrTargetNotFound
	}
	if !found {
		return nil, nil
	}
	title := "Preview of " + targetId
	return &integrations.TargetPreview{OwnerId: owner, Title: &title, MediaUrls: []string{"https://cdn.example/" + targetId}, CreatedAt: "2026-10-01T00:00:00Z"}, nil
}

func (harness *moderationHarness) contentReportHandler() platformevents.MessageHandler {
	return contentreports.ReportCreatedHandler(harness.module.Container())
}

func (harness *moderationHarness) contentScoreHandler() platformevents.MessageHandler {
	return contentreports.ContentScoreHandler(harness.module.Container())
}

func (harness *moderationHarness) waitForPublished(eventType string) bool {
	for range 100 {
		for _, published := range harness.publisher.PublishedEventTypes() {
			if published == eventType {
				return true
			}
		}
		time.Sleep(50 * time.Millisecond)
	}
	return false
}

func reportCreatedEnvelope(reporter, targetType, targetId, reason, details string) []byte {
	data, _ := json.Marshal(map[string]any{"reportId": uuid.NewString(), "reporterId": reporter, "targetType": targetType, "targetId": targetId, "reason": reason, "details": details, "priority": "normal"})
	envelope, _ := json.Marshal(map[string]any{"id": uuid.NewString(), "type": "report.created", "source": "social", "subject": "s", "schemaVersion": 1, "occurredAt": "2026-10-03T10:00:00Z", "data": json.RawMessage(data)})
	return envelope
}

func TestStrikeStoreIsIdempotentExpiresAndFeedsUserDetail(t *testing.T) {
	harness := startModerationAgainstFreshSchema(t)
	account := uuid.NewString()
	body := map[string]any{"policy": "Spam", "reason": "posted the same ad forty times", "source": "moderation", "referenceType": "content_report", "referenceId": "r-1", "issuedByName": "Ada"}
	harness.expect("POST", "/api/v1/internal/accounts/"+account+"/strikes", "", body, http.StatusUnauthorized)
	first := harness.expect("POST", "/api/v1/internal/accounts/"+account+"/strikes", "", body, http.StatusCreated, intakeToken...)
	again := harness.expect("POST", "/api/v1/internal/accounts/"+account+"/strikes", "", body, http.StatusOK, intakeToken...)
	if first["id"] != again["id"] || again["created"] != false || first["activeStrikeCount"] != float64(1) {
		t.Fatalf("a reference issues one strike: %v %v", first, again)
	}
	harness.expect("POST", "/api/v1/internal/accounts/"+account+"/strikes", "", map[string]any{"kind": "warning", "policy": "Spam", "reason": "first warning given", "expiresInDays": 1}, http.StatusCreated, intakeToken...)
	harness.expect("POST", "/api/v1/internal/accounts/"+account+"/strikes", "", map[string]any{"kind": "bogus", "policy": "Spam", "reason": "first warning given"}, http.StatusBadRequest, intakeToken...)
	listing := harness.expect("GET", "/api/v1/internal/accounts/"+account+"/strikes", "", nil, http.StatusOK, intakeToken...)
	strikes := listing["strikes"].([]any)
	if len(strikes) != 2 || listing["strikeCount"] != float64(1) || listing["warningCount"] != float64(1) || listing["isRepeatInfringer"] != false {
		t.Fatalf("unexpected listing %v", listing)
	}
	for _, item := range strikes {
		for _, field := range []string{"id", "policy", "reason", "source", "issuedAt", "expiresAt", "issuedByName"} {
			if _, present := item.(map[string]any)[field]; !present {
				t.Fatalf("UserDetail strikes carry %s: %v", field, item)
			}
		}
	}
	if _, err := harness.database.Exec(`UPDATE strikes SET expires_at = now() - interval '1 day' WHERE kind = 'warning'`); err != nil {
		t.Fatal(err)
	}
	counts := harness.expect("POST", "/api/v1/internal/strikes/counts", "", map[string]any{"accountIds": []string{account, uuid.NewString()}}, http.StatusOK, intakeToken...)["data"].(map[string]any)
	if counts[account].(map[string]any)["strikeCount"] != float64(1) || counts[account].(map[string]any)["warningCount"] != float64(0) {
		t.Fatalf("expired warnings stop counting: %v", counts)
	}
	harness.expect("POST", "/api/v1/internal/strikes/"+first["id"].(string)+"/revoke", "", map[string]string{"reason": "appeal overturned"}, http.StatusNoContent, intakeToken...)
	after := harness.expect("GET", "/api/v1/internal/accounts/"+account+"/strikes?includeInactive=true", "", nil, http.StatusOK, intakeToken...)
	if after["strikeCount"] != float64(0) || len(after["strikes"].([]any)) != 2 {
		t.Fatalf("revoked strikes leave the active count but stay in history: %v", after)
	}
	if !harness.waitForPublished("strike.issued") || !harness.waitForPublished("strike.revoked") {
		t.Fatal("strike events are published through the outbox")
	}
}

func TestContentReportsGroupPerTargetAndActionsGoThroughEventsAndGoIdentity(t *testing.T) {
	harness := startModerationAgainstFreshSchema(t)
	author := uuid.NewString()
	harness.targets.own("post", "p-1", author)
	handler := harness.contentReportHandler()
	reporters := []string{uuid.NewString(), uuid.NewString(), uuid.NewString()}
	for index, reporter := range reporters {
		reason := []string{"spam", "scam_or_fraud", "scam_or_fraud"}[index]
		if err := handler(context.Background(), reportCreatedEnvelope(reporter, "post", "p-1", reason, "looks fake")); err != nil {
			t.Fatal(err)
		}
	}
	if err := handler(context.Background(), reportCreatedEnvelope(reporters[0], "message", "m-1", "spam", "")); err != nil {
		t.Fatal("chat targets belong to the chat report flow and are ignored")
	}
	if err := handler(context.Background(), []byte("nope")); err == nil {
		t.Fatal("malformed events are poison")
	}
	viewer, _ := harness.staff("moderation:reports")
	nobody, _ := harness.staff("metrics:read")
	harness.expect("GET", "/api/v1/admin/reports", nobody, nil, http.StatusForbidden)
	queue := harness.expect("GET", "/api/v1/admin/reports", viewer, nil, http.StatusOK)["data"].([]any)
	if len(queue) != 1 {
		t.Fatalf("one record per reported item: %v", queue)
	}
	summary := queue[0].(map[string]any)
	if summary["primaryReason"] != "SCAM" || summary["reportCount"] != float64(3) || summary["target"].(map[string]any)["type"] != "POST" || summary["target"].(map[string]any)["title"] != "Preview of p-1" {
		t.Fatalf("unexpected summary %v", summary)
	}
	counts := summary["reasonCounts"].([]any)
	if counts[0].(map[string]any)["reason"] != "SCAM" || counts[0].(map[string]any)["count"] != float64(2) {
		t.Fatalf("reason counts are grouped: %v", counts)
	}
	reportId := summary["id"].(string)
	detail := harness.expect("GET", "/api/v1/admin/reports/"+reportId, viewer, nil, http.StatusOK)
	if len(detail["reporterNotes"].([]any)) != 3 {
		t.Fatalf("reporter notes %v", detail["reporterNotes"])
	}
	acting, _ := harness.staff("moderation:reports")
	actions := "/api/v1/admin/reports/" + reportId + "/actions"
	harness.expect("POST", actions, acting, map[string]string{"action": "NOPE", "reason": "valid reason here"}, http.StatusBadRequest)
	harness.expect("POST", actions, acting, map[string]string{"action": "SUSPEND_AUTHOR", "reason": "valid reason here"}, http.StatusForbidden)
	decided := harness.expect("POST", actions, acting, map[string]string{"action": "REMOVE", "reason": "fake giveaway scam"}, http.StatusOK)
	if decided["status"] != "RESOLVED" || decided["target"].(map[string]any)["visibility"] != "REMOVED" || decided["decision"].(map[string]any)["action"] != "REMOVE" {
		t.Fatalf("unexpected decision %v", decided)
	}
	harness.expect("POST", actions, acting, map[string]string{"action": "HIDE", "reason": "valid reason here"}, http.StatusConflict)
	strikes := harness.expect("GET", "/api/v1/internal/accounts/"+author+"/strikes", "", nil, http.StatusOK, intakeToken...)
	if strikes["strikeCount"] != float64(1) || strikes["strikes"].([]any)[0].(map[string]any)["policy"] != "Scams and fraud" {
		t.Fatalf("removing content adds one strike: %v", strikes)
	}
	if !harness.waitForPublished("content.visibilityChanged") || !harness.waitForPublished("report.closed") {
		t.Fatal("the owning service hears about the removal and reporters hear about the outcome")
	}
	if len(harness.users.Requests) != 0 {
		t.Fatal("removing content does not restrict the account")
	}
}

func TestSuspendingAnAuthorNeedsStepUpAndGoesThroughGoIdentity(t *testing.T) {
	harness := startModerationAgainstFreshSchema(t)
	author := uuid.NewString()
	harness.targets.own("clip", "c-1", author)
	if err := harness.contentReportHandler()(context.Background(), reportCreatedEnvelope(uuid.NewString(), "clip", "c-1", "violence", "")); err != nil {
		t.Fatal(err)
	}
	token, stepUp := harness.staff("moderation:reports")
	queue := harness.expect("GET", "/api/v1/admin/reports?targetType=clip", token, nil, http.StatusOK)["data"].([]any)
	if queue[0].(map[string]any)["priority"] != "HIGH" {
		t.Fatalf("violence reports start at high priority: %v", queue[0])
	}
	path := "/api/v1/admin/reports/" + queue[0].(map[string]any)["id"].(string) + "/suspend-author"
	harness.expect("POST", path, token, map[string]any{"durationDays": 7, "reason": "credible threats"}, http.StatusForbidden)
	harness.expect("POST", path, token, map[string]any{"durationDays": 5, "reason": "credible threats"}, http.StatusBadRequest, stepUp...)
	done := harness.expect("POST", path, token, map[string]any{"durationDays": 7, "reason": "credible threats"}, http.StatusOK, stepUp...)
	forwarded := harness.users.last()
	if forwarded.Action != "suspend" || forwarded.UserId != author || forwarded.Source != "content_report" || forwarded.DurationDays == nil || *forwarded.DurationDays != 7 {
		t.Fatalf("suspension is enforced by goIdentity: %+v", forwarded)
	}
	if done["status"] != "RESOLVED" || done["target"].(map[string]any)["visibility"] != "HIDDEN" || !harness.audit.has("report.suspend_author") || !harness.audit.has("user.moderated.suspend_author") {
		t.Fatalf("unexpected %v", done)
	}
}

func TestClassifierScoresAreAdvisoryAndStaffDismissalRestoresTheContent(t *testing.T) {
	harness := startModerationAgainstFreshSchema(t)
	author := uuid.NewString()
	harness.targets.own("post", "p-9", author)
	handler := harness.contentScoreHandler()
	score := func(id string, value float64, action string) []byte {
		body, _ := json.Marshal(map[string]any{"scoreId": id, "targetType": "post", "targetId": "p-9", "ownerId": author, "score": value, "suggestedAction": action, "modelVersion": "mod-1", "advisoryOnly": true, "categories": []map[string]any{{"category": "scam", "score": value}}})
		return body
	}
	if err := handler(context.Background(), score("s-0", 0.1, "allow")); err != nil {
		t.Fatal(err)
	}
	viewer, _ := harness.staff("moderation:reports")
	if queue := harness.expect("GET", "/api/v1/admin/reports?source=classifier", viewer, nil, http.StatusOK)["data"].([]any); len(queue) != 0 {
		t.Fatalf("allowed content creates no work: %v", queue)
	}
	for range 2 {
		if err := handler(context.Background(), score("s-1", 0.6, "review")); err != nil {
			t.Fatal(err)
		}
	}
	queue := harness.expect("GET", "/api/v1/admin/reports?source=classifier", viewer, nil, http.StatusOK)["data"].([]any)
	item := queue[0].(map[string]any)
	if len(queue) != 1 || item["classifierAction"] != "reduce" || item["target"].(map[string]any)["visibility"] != "RESTRICTED" || item["reportCount"] != float64(1) {
		t.Fatalf("a medium score reduces reach once and waits for review: %v", queue)
	}
	if err := handler(context.Background(), score("s-2", 0.93, "block")); err != nil {
		t.Fatal(err)
	}
	held := harness.expect("GET", "/api/v1/admin/reports/"+item["id"].(string), viewer, nil, http.StatusOK)
	if held["classifierAction"] != "hold" || held["target"].(map[string]any)["visibility"] != "HIDDEN" || len(held["classifierScores"].([]any)) != 1 {
		t.Fatalf("a high score holds the content for review: %v", held)
	}
	if len(harness.users.Requests) != 0 || harness.expect("GET", "/api/v1/internal/accounts/"+author+"/strikes", "", nil, http.StatusOK, intakeToken...)["strikeCount"] != float64(0) {
		t.Fatal("scores never strike or restrict anyone")
	}
	dismissed := harness.expect("POST", "/api/v1/admin/reports/"+item["id"].(string)+"/actions", viewer, map[string]string{"action": "DISMISS", "reason": "reviewed: legitimate listing"}, http.StatusOK)
	if dismissed["status"] != "DISMISSED" || dismissed["target"].(map[string]any)["visibility"] != "VISIBLE" {
		t.Fatalf("dismissing a held item restores it: %v", dismissed)
	}
	if err := handler(context.Background(), score("s-3", 0.95, "block")); err != nil {
		t.Fatal(err)
	}
	again := harness.expect("GET", "/api/v1/admin/reports/"+item["id"].(string), viewer, nil, http.StatusOK)
	if again["target"].(map[string]any)["visibility"] != "VISIBLE" {
		t.Fatal("a staff decision wins over later automated scores")
	}
	if err := handler(context.Background(), []byte("{")); err == nil {
		t.Fatal("malformed scores are poison")
	}
}

func TestLegacyProhibitedItemsReasonIsAcceptedNotPoisoned(t *testing.T) {
	harness := startModerationAgainstFreshSchema(t)
	harness.targets.own("product", "prd-legacy", uuid.NewString())
	if err := harness.contentReportHandler()(context.Background(), reportCreatedEnvelope(uuid.NewString(), "product", "prd-legacy", "prohibited_items", "")); err != nil {
		t.Fatalf("older events with prohibited_items must not be poison: %v", err)
	}
	viewer, _ := harness.staff("moderation:reports")
	if queue := harness.expect("GET", "/api/v1/admin/reports?targetType=product", viewer, nil, http.StatusOK)["data"].([]any); len(queue) != 1 || queue[0].(map[string]any)["primaryReason"] != "OTHER" {
		t.Fatalf("prohibited_items maps to OTHER: %v", queue)
	}
}
