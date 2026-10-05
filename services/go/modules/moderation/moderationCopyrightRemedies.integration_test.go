package moderation

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	announceexpiredstrikes "zudomart/modules/moderation/src/modules/accountHealth/commands/announceExpiredStrikes"
	enforcetakedowndeadlines "zudomart/modules/moderation/src/modules/copyrightClaims/commands/enforceTakedownDeadlines"
	restoreacceptedtakedowns "zudomart/modules/moderation/src/modules/copyrightClaims/commands/restoreAcceptedTakedowns"
)

func (harness *moderationHarness) fileAndUphold(targetType, targetId, scope, uploader string) (string, map[string]any) {
	harness.targets.own(targetType, targetId, uploader)
	_, claimantToken := harness.reporter()
	body := copyrightClaimBody(targetType, targetId)
	body["claimScope"] = scope
	claimId := harness.expect("POST", "/api/v1/copyright/claims", claimantToken, body, http.StatusCreated)["claimId"].(string)
	reviewer, stepUp := harness.staff("copyright:review")
	return claimId, harness.expect("POST", "/api/v1/admin/copyright-claims/"+claimId+"/uphold", reviewer, map[string]string{"reason": "proof of ownership matches"}, http.StatusOK, stepUp...)
}

func (harness *moderationHarness) accountStatus(accountId string) map[string]any {
	return harness.expect("GET", "/api/v1/account/status", harness.tokens.SignAccountAccessToken(harness.t, accountId), nil, http.StatusOK)
}

func (harness *moderationHarness) claimDetail(claimId string) map[string]any {
	reviewer, _ := harness.staff("copyright:review")
	return harness.expect("GET", "/api/v1/admin/copyright-claims/"+claimId, reviewer, nil, http.StatusOK)
}

func (harness *moderationHarness) publishedPayload(eventType string) map[string]any {
	harness.waitForPublished(eventType)
	for _, event := range harness.publisher.Published {
		if event.EventType == eventType {
			var envelope struct {
				Data map[string]any `json:"data"`
			}
			_ = json.Unmarshal(event.Payload, &envelope)
			return envelope.Data
		}
	}
	return nil
}

func (harness *moderationHarness) shiftClock(by time.Duration) {
	harness.module.Container().Now = func() time.Time { return time.Now().Add(by) }
}

func postDeletedEnvelope(postId string) []byte {
	data, _ := json.Marshal(map[string]any{"postId": postId, "kind": "clip"})
	envelope, _ := json.Marshal(map[string]any{"id": uuid.NewString(), "type": "post.deleted", "source": "social", "subject": postId, "schemaVersion": 1, "occurredAt": time.Now().UTC().Format(time.RFC3339), "data": json.RawMessage(data)})
	return envelope
}

func TestAudioClaimMutesTheSoundtrackKeepsTheVideoAndRestoresAfterCounterNotice(t *testing.T) {
	harness := startModerationAgainstFreshSchema(t)
	uploader := uuid.NewString()
	claimId, upheld := harness.fileAndUphold("clip", uuid.NewString(), "audio", uploader)
	if upheld["remedy"] != "AUDIO_MUTED" || upheld["targetFlag"] != "MUTED" || upheld["remedyState"] != "MUTED" || upheld["infringerStrikeCount"] != float64(0) {
		t.Fatalf("an audio claim mutes without a strike: %v", upheld)
	}
	ordered := harness.publishedPayload("copyrightClaim.audioMuteOrdered")
	if ordered == nil || ordered["infringerId"] != uploader || ordered["canSubmitCounterNotice"] != true {
		t.Fatalf("the mute order carries the uploader and their counter-notice right: %v", ordered)
	}
	for _, published := range harness.publisher.PublishedEventTypes() {
		if published == "content.visibilityChanged" {
			t.Fatal("the video stays up when only the audio is claimed")
		}
	}
	status := harness.accountStatus(uploader)
	notices := status["notices"].([]any)
	if status["status"] != "GOOD_STANDING" || len(notices) != 1 || notices[0].(map[string]any)["remedy"] != "AUDIO_MUTED" || notices[0].(map[string]any)["canCounterNotice"] != true {
		t.Fatalf("the account page lists the muted content: %v", status)
	}
	created := harness.expect("POST", "/api/v1/copyright/claims/"+claimId+"/counter-notices", harness.tokens.SignAccountAccessToken(t, uploader), map[string]any{"statement": "I licensed this track", "contactEmail": "me@example.com", "goodFaith": true}, http.StatusCreated)
	if received := harness.publishedPayload("copyrightClaim.counterNoticeReceived"); received["claimantEmail"] != "owner@label.com" {
		t.Fatalf("the claimant is told about the counter-notice: %v", received)
	}
	reviewer, stepUp := harness.staff("copyright:review")
	harness.expect("POST", "/api/v1/admin/copyright-claims/"+claimId+"/counter-notices/"+created["noticeId"].(string)+"/accept", reviewer, map[string]string{"reason": "licence provided"}, http.StatusOK, stepUp...)
	if _, err := harness.database.Exec(`UPDATE counter_notices SET restore_eligible_at = now() - interval '1 hour'`); err != nil {
		t.Fatal(err)
	}
	if restored, err := (restoreacceptedtakedowns.Handler{Container: harness.module.Container()}).Execute(context.Background()); err != nil || restored != 1 {
		t.Fatalf("restore %d %v", restored, err)
	}
	if payload := harness.publishedPayload("copyrightClaim.restored"); payload["remedy"] != "audio_muted" {
		t.Fatalf("the restore tells social to unmute: %v", payload)
	}
	if final := harness.claimDetail(claimId); final["remedyState"] != "RESTORED" || final["targetFlag"] != "VISIBLE" {
		t.Fatalf("unexpected %v", final)
	}
}

func TestVideoClaimWarnsThenTakesDownAtTheDeadlineWithAStrike(t *testing.T) {
	harness := startModerationAgainstFreshSchema(t)
	uploader, clipId := uuid.NewString(), uuid.NewString()
	claimId, upheld := harness.fileAndUphold("clip", clipId, "video", uploader)
	deadline, _ := time.Parse(time.RFC3339, upheld["takedownDeadlineAt"].(string))
	if upheld["remedy"] != "TAKEDOWN_WARNING" || upheld["targetFlag"] != "WARNED" || upheld["infringerStrikeCount"] != float64(0) || deadline.Sub(time.Now()) < 47*time.Hour || deadline.Sub(time.Now()) > 49*time.Hour {
		t.Fatalf("a video claim warns with a 48-hour deadline: %v", upheld)
	}
	if warning := harness.publishedPayload("copyrightClaim.warningIssued"); warning["deadlineAt"] == nil || warning["targetId"] != clipId {
		t.Fatalf("the warning notice carries the deadline: %v", warning)
	}
	status := harness.accountStatus(uploader)
	if status["status"] != "AT_RISK" || len(status["warnings"].([]any)) != 1 || status["notices"].([]any)[0].(map[string]any)["deadlineAt"] == nil {
		t.Fatalf("a pending deadline puts the account at risk and shows the countdown: %v", status)
	}
	deadlines := enforcetakedowndeadlines.Handler{Container: harness.module.Container()}
	if count, err := deadlines.Execute(context.Background()); err != nil || count != 0 {
		t.Fatalf("nothing happens before the deadline: %d %v", count, err)
	}
	harness.shiftClock(49 * time.Hour)
	if _, err := deadlines.Execute(context.Background()); err != nil {
		t.Fatal(err)
	}
	final := harness.claimDetail(claimId)
	if final["remedyState"] != "TAKEN_DOWN" || final["targetFlag"] != "TAKEN_DOWN" || final["infringerStrikeCount"] != float64(1) {
		t.Fatalf("the deadline takes the clip down and records a strike: %v", final)
	}
	if !harness.waitForPublished("copyrightClaim.contentTakenDown") || !harness.waitForPublished("content.visibilityChanged") || !harness.waitForPublished("accountHealth.changed") {
		t.Fatal("the takedown, visibility change and health change are published")
	}
	strikes := harness.accountStatus(uploader)["strikes"].([]any)
	strikeId := strikes[0].(map[string]any)["id"].(string)
	uploaderToken := harness.tokens.SignAccountAccessToken(t, uploader)
	harness.expect("POST", "/api/v1/account/status/strikes/"+strikeId+"/appeal", uploaderToken, map[string]string{"message": "short"}, http.StatusBadRequest)
	harness.expect("POST", "/api/v1/account/status/strikes/"+strikeId+"/appeal", uploaderToken, map[string]string{"message": "I removed the clip but the notice arrived while I was offline"}, http.StatusAccepted)
	harness.expect("POST", "/api/v1/account/status/strikes/"+strikeId+"/appeal", uploaderToken, map[string]string{"message": "I removed the clip but the notice arrived while I was offline"}, http.StatusConflict)
	appeals, _ := harness.staff("moderation:appeals")
	if queue := harness.expect("GET", "/api/v1/admin/strike-appeals", appeals, nil, http.StatusOK)["data"].([]any); len(queue) != 1 {
		t.Fatalf("the appeal is queued: %v", queue)
	}
	harness.expect("POST", "/api/v1/admin/strike-appeals/"+strikeId+"/overturn", appeals, map[string]string{"reason": "notice was not delivered"}, http.StatusOK)
	if after := harness.accountStatus(uploader); len(after["strikes"].([]any)) != 0 {
		t.Fatalf("an overturned appeal removes the strike: %v", after)
	}
}

func TestVoluntaryRemovalBeforeTheDeadlineKeepsOnlyTheWarning(t *testing.T) {
	harness := startModerationAgainstFreshSchema(t)
	uploader, clipId := uuid.NewString(), uuid.NewString()
	claimId, _ := harness.fileAndUphold("clip", clipId, "video", uploader)
	if err := harness.contentReportHandler()(context.Background(), postDeletedEnvelope(clipId)); err != nil {
		t.Fatal(err)
	}
	if state := harness.claimDetail(claimId)["remedyState"]; state != "REMOVED_VOLUNTARILY" {
		t.Fatalf("deleting the clip before the deadline is voluntary: %v", state)
	}
	harness.shiftClock(49 * time.Hour)
	if _, err := (enforcetakedowndeadlines.Handler{Container: harness.module.Container()}).Execute(context.Background()); err != nil {
		t.Fatal(err)
	}
	status := harness.accountStatus(uploader)
	if len(status["strikes"].([]any)) != 0 || len(status["warnings"].([]any)) != 1 || status["status"] != "GOOD_STANDING" {
		t.Fatalf("no strike, the warning stays on record: %v", status)
	}
	if !harness.waitForPublished("copyrightClaim.contentRemovedVoluntarily") {
		t.Fatal("the voluntary removal is published")
	}
}

func TestThirdCopyrightStrikeRestrictsOpensSuspensionReviewAndStrikesExpire(t *testing.T) {
	harness := startModerationAgainstFreshSchema(t)
	uploader := uuid.NewString()
	for index := range 3 {
		if _, upheld := harness.fileAndUphold("live", uuid.NewString(), "video", uploader); upheld["infringerStrikeCount"] != float64(index+1) {
			t.Fatalf("live claims take down immediately with a strike: %v", upheld)
		}
	}
	if last := harness.users.last(); last.Action != "restrict" || len(last.Features) != 1 || last.Features[0] != "GOING_LIVE" || last.Source != "copyright" {
		t.Fatalf("three strikes in the window restrict going live: %+v", last)
	}
	status := harness.accountStatus(uploader)
	if status["status"] != "RESTRICTED" || status["canMonetise"] != false || status["canGoLive"] != false || status["copyrightStrikesInWindow"] != float64(3) {
		t.Fatalf("unexpected %v", status)
	}
	var cases int
	if err := harness.database.QueryRow(`SELECT count(*) FROM suspension_cases WHERE source = 'copyright_strikes'`).Scan(&cases); err != nil || cases != 1 {
		t.Fatalf("a suspension review is opened once: %d %v", cases, err)
	}
	staff, _ := harness.staff("users:read")
	if admin := harness.expect("GET", "/api/v1/admin/account-health/"+uploader, staff, nil, http.StatusOK); admin["status"] != "RESTRICTED" {
		t.Fatalf("admin sees the same summary: %v", admin)
	}
	if _, err := harness.database.Exec(`UPDATE strikes SET expires_at = now() - interval '1 minute'`); err != nil {
		t.Fatal(err)
	}
	if expired, err := (announceexpiredstrikes.Handler{Container: harness.module.Container()}).Execute(context.Background()); err != nil || expired != 3 {
		t.Fatalf("expired strikes are announced once: %d %v", expired, err)
	}
	if again, _ := (announceexpiredstrikes.Handler{Container: harness.module.Container()}).Execute(context.Background()); again != 0 || !harness.waitForPublished("strike.expired") {
		t.Fatal("expiry is announced exactly once")
	}
	if after := harness.accountStatus(uploader); after["status"] != "GOOD_STANDING" {
		t.Fatalf("expired strikes return the account to good standing: %v", after)
	}
}

func TestCopyrightPolicyIsAdminConfigurable(t *testing.T) {
	harness := startModerationAgainstFreshSchema(t)
	reviewer, stepUp := harness.staff("copyright:review")
	if policy := harness.expect("GET", "/api/v1/admin/copyright-policy", reviewer, nil, http.StatusOK); policy["takedownDeadlineHours"] != float64(48) || policy["strikeLifetimeDays"] != float64(90) {
		t.Fatalf("defaults: %v", policy)
	}
	update := map[string]any{"takedownDeadlineHours": 24, "strikeLifetimeDays": 60, "warningLifetimeDays": 180, "strikeWindowDays": 60, "restrictionThreshold": 2, "suspensionReviewThreshold": 3, "restrictionDays": 14, "reason": "tighter policy for launch"}
	harness.expect("PUT", "/api/v1/admin/copyright-policy", reviewer, update, http.StatusForbidden)
	harness.expect("PUT", "/api/v1/admin/copyright-policy", reviewer, update, http.StatusOK, stepUp...)
	_, upheld := harness.fileAndUphold("clip", uuid.NewString(), "video", uuid.NewString())
	deadline, _ := time.Parse(time.RFC3339, upheld["takedownDeadlineAt"].(string))
	if hours := deadline.Sub(time.Now()).Hours(); hours < 23 || hours > 25 {
		t.Fatalf("the configured deadline applies: %v", hours)
	}
	if !harness.audit.has("copyright.policy_updated") {
		t.Fatal("policy changes are audited")
	}
}
