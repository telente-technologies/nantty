package moderation

import (
	"context"
	"net/http"
	"testing"

	"github.com/google/uuid"
)

func (harness *moderationHarness) reportAndDecide(targetType, targetId, author, action string, permissions ...string) (string, string) {
	harness.t.Helper()
	harness.targets.own(targetType, targetId, author)
	if err := harness.contentReportHandler()(context.Background(), reportCreatedEnvelope(uuid.NewString(), targetType, targetId, "spam", "")); err != nil {
		harness.t.Fatal(err)
	}
	decider, stepUp := harness.staff(append([]string{"moderation:reports"}, permissions...)...)
	queue := harness.expect("GET", "/api/v1/admin/reports?search="+targetId, decider, nil, http.StatusOK)["data"].([]any)
	reportId := queue[0].(map[string]any)["id"].(string)
	harness.expect("POST", "/api/v1/admin/reports/"+reportId+"/actions", decider, map[string]string{"action": action, "reason": "breaks the spam policy"}, http.StatusOK, stepUp...)
	return reportId, decider
}

func TestHiddenContentCanBeAppealedAndAnOverturnRestoresIt(t *testing.T) {
	harness := startModerationAgainstFreshSchema(t)
	author := uuid.NewString()
	authorToken := harness.tokens.SignAccountAccessToken(t, author)
	reportId, _ := harness.reportAndDecide("post", "p-appeal", author, "HIDE")
	mine := harness.expect("GET", "/api/v1/moderation/decisions/me", authorToken, nil, http.StatusOK)["data"].([]any)
	if len(mine) != 1 || mine[0].(map[string]any)["action"] != "HIDE" || mine[0].(map[string]any)["appealable"] != true {
		t.Fatalf("the author sees the decision against them: %v", mine)
	}
	_, stranger := harness.reporter()
	statement := map[string]string{"message": "This post is a genuine giveaway from my own store."}
	harness.expect("POST", "/api/v1/moderation/decisions/"+reportId+"/appeal", stranger, statement, http.StatusNotFound)
	harness.expect("POST", "/api/v1/moderation/decisions/"+reportId+"/appeal", authorToken, map[string]string{"message": "too short"}, http.StatusBadRequest)
	received := harness.expect("POST", "/api/v1/moderation/decisions/"+reportId+"/appeal", authorToken, statement, http.StatusAccepted)
	harness.expect("POST", "/api/v1/moderation/decisions/"+reportId+"/appeal", authorToken, statement, http.StatusConflict)
	appealId := received["appealId"].(string)

	reviewer, _ := harness.staff("moderation:appeals")
	nobody, _ := harness.staff("moderation:reports")
	harness.expect("GET", "/api/v1/admin/appeals", nobody, nil, http.StatusForbidden)
	queue := harness.expect("GET", "/api/v1/admin/appeals?decisionType=CONTENT_REMOVED", reviewer, nil, http.StatusOK)["data"].([]any)
	if len(queue) != 1 {
		t.Fatalf("the pending appeal is queued: %v", queue)
	}
	summary := queue[0].(map[string]any)
	original := summary["originalDecision"].(map[string]any)
	if summary["status"] != "PENDING" || summary["userStatement"] != statement["message"] || original["action"] != "HIDE" || original["reportId"] != reportId || summary["target"].(map[string]any)["visibility"] != "HIDDEN" || summary["appellant"].(map[string]any)["id"] != author {
		t.Fatalf("unexpected appeal summary %v", summary)
	}
	if found := harness.expect("GET", "/api/v1/admin/appeals?search=p-appeal", reviewer, nil, http.StatusOK)["data"].([]any); len(found) != 1 {
		t.Fatalf("search matches the target: %v", found)
	}
	harness.expect("GET", "/api/v1/admin/appeals?status=BOGUS", reviewer, nil, http.StatusBadRequest)
	path := "/api/v1/admin/appeals/" + appealId + "/decide"
	harness.expect("POST", path, reviewer, map[string]string{"outcome": "MAYBE", "reason": "looked again"}, http.StatusBadRequest)
	decided := harness.expect("POST", path, reviewer, map[string]string{"outcome": "OVERTURNED", "reason": "The giveaway is genuine."}, http.StatusOK)
	if decided["status"] != "OVERTURNED" || decided["decision"].(map[string]any)["outcome"] != "overturned" || decided["target"].(map[string]any)["visibility"] != "VISIBLE" {
		t.Fatalf("an overturn restores the content: %v", decided)
	}
	harness.expect("POST", path, reviewer, map[string]string{"outcome": "UPHELD", "reason": "second look"}, http.StatusConflict)
	restored := harness.publishedPayload("appeal.decided")
	if restored["outcome"] != "overturned" || restored["caseId"] != appealId || !harness.audit.has("appeal.overturned") {
		t.Fatalf("the appellant is told and the decision is audited: %v", restored)
	}
	if !harness.waitForPublished("content.visibilityChanged") {
		t.Fatal("the owning service restores the content")
	}
}

func TestStrikeAppealsJoinTheUnifiedQueueWithFourEyes(t *testing.T) {
	harness := startModerationAgainstFreshSchema(t)
	author := uuid.NewString()
	authorToken := harness.tokens.SignAccountAccessToken(t, author)
	_, decider := harness.reportAndDecide("clip", "c-strike", author, "REMOVE", "moderation:appeals")
	strikes := harness.expect("GET", "/api/v1/account/status", authorToken, nil, http.StatusOK)
	strikeId := firstStrikeId(t, strikes)
	harness.expect("POST", "/api/v1/account/status/strikes/"+strikeId+"/appeal", authorToken, map[string]string{"message": "The clip was my own original footage."}, http.StatusAccepted)
	reviewer, _ := harness.staff("moderation:appeals")
	queue := harness.expect("GET", "/api/v1/admin/appeals", reviewer, nil, http.StatusOK)["data"].([]any)
	if len(queue) != 1 || queue[0].(map[string]any)["decisionType"] != "CONTENT_REMOVED" {
		t.Fatalf("a strike from a removal is a CONTENT_REMOVED appeal: %v", queue)
	}
	appealId := queue[0].(map[string]any)["id"].(string)
	harness.expect("POST", "/api/v1/admin/appeals/"+appealId+"/decide", decider, map[string]string{"outcome": "OVERTURNED", "reason": "I changed my mind."}, http.StatusConflict)
	upheld := harness.expect("POST", "/api/v1/admin/appeals/"+appealId+"/decide", reviewer, map[string]string{"outcome": "UPHELD", "reason": "The footage is not original."}, http.StatusOK)
	if upheld["status"] != "UPHELD" {
		t.Fatalf("unexpected %v", upheld)
	}
	after := harness.expect("GET", "/api/v1/account/status", authorToken, nil, http.StatusOK)
	if firstStrikeField(t, after, "appealStatus") != "UPHELD" {
		t.Fatalf("the strike carries the outcome: %v", after)
	}
}

func TestRevokingAnAuthorsVerificationNeedsBothPermissionsAndStepUp(t *testing.T) {
	harness := startModerationAgainstFreshSchema(t)
	author := uuid.NewString()
	harness.targets.own("product", "prd-1", author)
	if err := harness.contentReportHandler()(context.Background(), reportCreatedEnvelope(uuid.NewString(), "product", "prd-1", "counterfeit_product", "")); err != nil {
		t.Fatal(err)
	}
	moderator, moderatorStepUp := harness.staff("moderation:reports")
	both, bothStepUp := harness.staff("moderation:reports", "verification:revoke")
	reportId := harness.expect("GET", "/api/v1/admin/reports", moderator, nil, http.StatusOK)["data"].([]any)[0].(map[string]any)["id"].(string)
	path := "/api/v1/admin/reports/" + reportId + "/revoke-author-verification"
	body := map[string]string{"reason": "Sells counterfeit goods under a verified badge."}
	harness.expect("POST", path, both, body, http.StatusForbidden)
	harness.expect("POST", path, moderator, body, http.StatusForbidden, moderatorStepUp...)
	harness.expect("POST", path, both, map[string]any{"reason": "x", "extra": true}, http.StatusBadRequest, bothStepUp...)
	harness.expect("POST", path, both, body, http.StatusConflict, bothStepUp...)
	harness.users.mutex.Lock()
	harness.users.Verified[author] = true
	harness.users.mutex.Unlock()
	done := harness.expect("POST", path, both, body, http.StatusOK, bothStepUp...)
	forwarded := harness.users.last()
	if forwarded.Action != "revoke_verification" || forwarded.UserId != author || !forwarded.Actor.StepUp {
		t.Fatalf("revocation goes through goIdentity: %+v", forwarded)
	}
	if done["status"] != "RESOLVED" || done["decision"].(map[string]any)["action"] != "REVOKE_AUTHOR_VERIFICATION" || !harness.audit.has("report.revoke_author_verification") || !harness.audit.has("user.moderated.revoke_author_verification") {
		t.Fatalf("unexpected %v", done)
	}
	harness.expect("POST", path, both, body, http.StatusConflict, bothStepUp...)
}

func TestSelfReportsAndMissingTargetsAreIgnoredAtIntake(t *testing.T) {
	harness := startModerationAgainstFreshSchema(t)
	author := uuid.NewString()
	harness.targets.own("post", "p-own", author)
	harness.targets.missing["post:p-gone"] = true
	handler := harness.contentReportHandler()
	for _, envelope := range [][]byte{reportCreatedEnvelope(author, "post", "p-own", "spam", ""), reportCreatedEnvelope(uuid.NewString(), "post", "p-gone", "spam", "")} {
		if err := handler(context.Background(), envelope); err != nil {
			t.Fatal(err)
		}
	}
	viewer, _ := harness.staff("moderation:reports")
	if queue := harness.expect("GET", "/api/v1/admin/reports?status=ALL", viewer, nil, http.StatusOK)["data"].([]any); len(queue) != 0 {
		t.Fatalf("self-reports and deleted targets create no work: %v", queue)
	}
}

func firstStrikeField(t *testing.T, status map[string]any, field string) any {
	t.Helper()
	strikes, _ := status["strikes"].([]any)
	if len(strikes) == 0 {
		t.Fatalf("no strikes in %v", status)
	}
	return strikes[0].(map[string]any)[field]
}

func firstStrikeId(t *testing.T, status map[string]any) string {
	t.Helper()
	identifier, _ := firstStrikeField(t, status, "id").(string)
	return identifier
}

func TestOverturningASuspensionThroughTheLegacyRouteLiftsItAndRestoresTheContent(t *testing.T) {
	harness := startModerationAgainstFreshSchema(t)
	author := uuid.NewString()
	authorToken := harness.tokens.SignAccountAccessToken(t, author)
	harness.targets.own("clip", "c-susp", author)
	if err := harness.contentReportHandler()(context.Background(), reportCreatedEnvelope(uuid.NewString(), "clip", "c-susp", "violence", "")); err != nil {
		t.Fatal(err)
	}
	moderator, stepUp := harness.staff("moderation:reports")
	reportId := harness.expect("GET", "/api/v1/admin/reports", moderator, nil, http.StatusOK)["data"].([]any)[0].(map[string]any)["id"].(string)
	harness.expect("POST", "/api/v1/admin/reports/"+reportId+"/suspend-author", moderator, map[string]any{"durationDays": 7, "reason": "credible threats"}, http.StatusOK, stepUp...)
	strikeId := firstStrikeId(t, harness.expect("GET", "/api/v1/account/status", authorToken, nil, http.StatusOK))
	harness.expect("POST", "/api/v1/account/status/strikes/"+strikeId+"/appeal", authorToken, map[string]string{"message": "It was a scene from a film I am making."}, http.StatusAccepted)
	reviewer, _ := harness.staff("moderation:appeals")
	queue := harness.expect("GET", "/api/v1/admin/appeals?decisionType=SUSPENSION", reviewer, nil, http.StatusOK)["data"].([]any)
	if len(queue) != 1 {
		t.Fatalf("report suspensions appear as SUSPENSION appeals: %v", queue)
	}
	harness.expect("POST", "/api/v1/admin/strike-appeals/"+strikeId+"/overturn", reviewer, map[string]string{"reason": "Clearly fiction, context given."}, http.StatusOK)
	if lifted := harness.users.last(); lifted.Action != "reinstate" || lifted.UserId != author {
		t.Fatalf("the suspension is lifted through goIdentity: %+v", lifted)
	}
	detail := harness.expect("GET", "/api/v1/admin/appeals/"+queue[0].(map[string]any)["id"].(string), reviewer, nil, http.StatusOK)
	if detail["status"] != "OVERTURNED" || detail["target"].(map[string]any)["visibility"] != "VISIBLE" {
		t.Fatalf("the unified appeal is decided by the legacy route: %v", detail)
	}
	if after := harness.expect("GET", "/api/v1/internal/accounts/"+author+"/strikes", "", nil, http.StatusOK, intakeToken...); after["strikeCount"] != float64(0) {
		t.Fatalf("the strike is revoked: %v", after)
	}
}
