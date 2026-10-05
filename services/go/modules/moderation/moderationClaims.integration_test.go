package moderation

import (
	"context"
	"net/http"
	"testing"

	"github.com/google/uuid"

	restoreacceptedtakedowns "zudomart/modules/moderation/src/modules/copyrightClaims/commands/restoreAcceptedTakedowns"
)

func copyrightClaimBody(targetType, targetId string) map[string]any {
	return map[string]any{
		"targetType": targetType, "targetId": targetId, "workDescription": "My song Lagos Nights", "ownershipStatement": "I wrote and recorded it", "contactEmail": "owner@label.com", "goodFaith": true,
		"claimantName": "Ada Obi", "originalWorkUrl": "https://music.example/lagos-nights", "proofUrls": []string{"https://registry.example/certificates/1"},
		"segments": []map[string]float64{{"startSeconds": 2, "endSeconds": 31}}, "accuracyDeclared": true, "signatureName": "Ada Obi",
	}
}

func TestCopyrightClaimLifecycleFromFilingToCounterNoticeAndRestoration(t *testing.T) {
	harness := startModerationAgainstFreshSchema(t)
	uploader := uuid.NewString()
	harness.targets.own("live", "clip-1", uploader)
	_, claimantToken := harness.reporter()
	harness.expect("POST", "/api/v1/copyright/claims", "", copyrightClaimBody("live", "clip-1"), http.StatusUnauthorized)
	noGoodFaith := copyrightClaimBody("live", "clip-1")
	noGoodFaith["goodFaith"] = false
	if got := harness.expect("POST", "/api/v1/copyright/claims", claimantToken, noGoodFaith, http.StatusUnprocessableEntity); got["code"] != "GOOD_FAITH_REQUIRED" {
		t.Fatalf("unexpected %v", got)
	}
	noSignature := copyrightClaimBody("live", "clip-1")
	noSignature["signatureName"] = ""
	if got := harness.expect("POST", "/api/v1/copyright/claims", claimantToken, noSignature, http.StatusUnprocessableEntity); got["code"] != "SIGNATURE_REQUIRED" {
		t.Fatalf("unexpected %v", got)
	}
	noProof := copyrightClaimBody("live", "clip-1")
	delete(noProof, "proofUrls")
	harness.expect("POST", "/api/v1/copyright/claims", claimantToken, noProof, http.StatusBadRequest)
	badEmail := copyrightClaimBody("live", "clip-1")
	badEmail["contactEmail"] = "nope"
	harness.expect("POST", "/api/v1/copyright/claims", claimantToken, badEmail, http.StatusBadRequest)
	key := []string{"Idempotency-Key", "claim-key-1"}
	receipt := harness.expect("POST", "/api/v1/copyright/claims", claimantToken, copyrightClaimBody("live", "clip-1"), http.StatusCreated, key...)
	replay := harness.expect("POST", "/api/v1/copyright/claims", claimantToken, copyrightClaimBody("live", "clip-1"), http.StatusCreated, key...)
	if receipt["status"] != "received" || receipt["claimId"] != replay["claimId"] {
		t.Fatalf("the receipt matches the mobile contract and replays: %v %v", receipt, replay)
	}
	claimId := receipt["claimId"].(string)

	reviewer, stepUp := harness.staff("copyright:review")
	nobody, _ := harness.staff("metrics:read")
	harness.expect("GET", "/api/v1/admin/copyright-claims", nobody, nil, http.StatusForbidden)
	queue := harness.expect("GET", "/api/v1/admin/copyright-claims", reviewer, nil, http.StatusOK)["data"].([]any)
	if len(queue) != 1 || queue[0].(map[string]any)["status"] != "PENDING" || queue[0].(map[string]any)["targetFlag"] != "VISIBLE" || queue[0].(map[string]any)["claimant"].(map[string]any)["email"] != "owner@label.com" {
		t.Fatalf("unexpected queue %v", queue)
	}
	base := "/api/v1/admin/copyright-claims/" + claimId
	harness.expect("PUT", "/api/v1/internal/copyright-claims/"+claimId+"/audio-matches", "", map[string]any{"matches": []any{map[string]any{"matchedTrack": "Lagos Nights", "artist": "DJ", "confidencePercent": 93, "source": "fingerprint"}}}, http.StatusNoContent, intakeToken...)
	harness.expect("POST", base+"/request-info", reviewer, map[string]string{"reason": "send the registration"}, http.StatusOK)
	harness.expect("POST", base+"/request-info", reviewer, map[string]string{"reason": "send the registration"}, http.StatusConflict)
	harness.expect("POST", base+"/uphold", reviewer, map[string]string{"reason": "audio fingerprint matches"}, http.StatusForbidden)
	upheld := harness.expect("POST", base+"/uphold", reviewer, map[string]string{"reason": "audio fingerprint matches"}, http.StatusOK, stepUp...)
	if upheld["status"] != "UPHELD" || upheld["targetFlag"] != "TAKEN_DOWN" || upheld["infringerStrikeCount"] != float64(1) || upheld["topAudioMatchConfidencePercent"] != float64(93) || upheld["repeatInfringerThreshold"] != float64(3) {
		t.Fatalf("unexpected %v", upheld)
	}
	if conflict := harness.expect("POST", base+"/reject", reviewer, map[string]string{"reason": "changed my mind"}, http.StatusConflict); conflict["code"] != "CLAIM_STATE_CONFLICT" {
		t.Fatalf("unexpected %v", conflict)
	}
	strikes := harness.expect("GET", "/api/v1/internal/accounts/"+uploader+"/strikes", "", nil, http.StatusOK, intakeToken...)["strikes"].([]any)
	if len(strikes) != 1 || strikes[0].(map[string]any)["source"] != "COPYRIGHT" {
		t.Fatalf("an upheld claim adds one copyright strike: %v", strikes)
	}
	if !harness.audit.has("copyright.upheld") || !harness.audit.has("user.copyright_strike_added") || !harness.waitForPublished("copyrightClaim.decided") || !harness.waitForPublished("content.visibilityChanged") {
		t.Fatal("audit and events record the takedown")
	}

	stranger := harness.tokens.SignAccountAccessToken(t, uuid.NewString())
	notice := map[string]any{"statement": "This is my own original recording", "contactEmail": "me@example.com", "goodFaith": true}
	harness.expect("POST", "/api/v1/copyright/claims/"+claimId+"/counter-notices", stranger, notice, http.StatusNotFound)
	uploaderToken := harness.tokens.SignAccountAccessToken(t, uploader)
	created := harness.expect("POST", "/api/v1/copyright/claims/"+claimId+"/counter-notices", uploaderToken, notice, http.StatusCreated)
	noticeId := created["noticeId"].(string)
	if _, ok := created["restoreEligibleAt"].(string); !ok {
		t.Fatalf("the restore date is ten business days out: %v", created)
	}
	harness.expect("POST", "/api/v1/copyright/claims/"+claimId+"/counter-notices", uploaderToken, notice, http.StatusConflict)
	if status := harness.expect("GET", base, reviewer, nil, http.StatusOK)["status"]; status != "COUNTER_NOTICE" {
		t.Fatalf("status %v", status)
	}
	harness.expect("POST", base+"/counter-notices/"+noticeId+"/accept", reviewer, map[string]string{"reason": "valid counter-notice"}, http.StatusForbidden)
	accepted := harness.expect("POST", base+"/counter-notices/"+noticeId+"/accept", reviewer, map[string]string{"reason": "valid counter-notice"}, http.StatusOK, stepUp...)
	if accepted["counterNotices"].([]any)[0].(map[string]any)["status"] != "ACCEPTED" {
		t.Fatalf("unexpected %v", accepted)
	}
	if again := harness.expect("POST", base+"/counter-notices/"+noticeId+"/accept", reviewer, map[string]string{"reason": "valid counter-notice"}, http.StatusConflict, stepUp...); again["code"] != "COUNTER_NOTICE_DECIDED" {
		t.Fatalf("unexpected %v", again)
	}
	restore := restoreacceptedtakedowns.Handler{Container: harness.module.Container()}
	if restored, err := restore.Execute(context.Background()); err != nil || restored != 0 {
		t.Fatalf("nothing restores before the date: %d %v", restored, err)
	}
	harness.expect("POST", base+"/counter-notices/"+noticeId+"/court-action", reviewer, map[string]string{"reason": "claimant filed suit"}, http.StatusOK, stepUp...)
	if _, err := harness.database.Exec(`UPDATE counter_notices SET restore_eligible_at = now() - interval '1 hour'`); err != nil {
		t.Fatal(err)
	}
	if restored, err := restore.Execute(context.Background()); err != nil || restored != 0 {
		t.Fatalf("court action blocks restoration: %d %v", restored, err)
	}
	if _, err := harness.database.Exec(`UPDATE counter_notices SET court_action_recorded = false`); err != nil {
		t.Fatal(err)
	}
	if restored, err := restore.Execute(context.Background()); err != nil || restored != 1 {
		t.Fatalf("the takedown is restored once the date passes: %d %v", restored, err)
	}
	final := harness.expect("GET", base, reviewer, nil, http.StatusOK)
	if final["status"] != "RESTORED" || final["targetFlag"] != "VISIBLE" || final["infringerStrikeCount"] != float64(0) {
		t.Fatalf("restoration clears the flag and removes the strike: %v", final)
	}
	if !harness.waitForPublished("copyrightClaim.restored") {
		t.Fatal("restoration is published")
	}
}

func TestRejectedCounterNoticeKeepsTheTakedown(t *testing.T) {
	harness := startModerationAgainstFreshSchema(t)
	uploader := uuid.NewString()
	harness.targets.own("sound", "s-1", uploader)
	_, claimantToken := harness.reporter()
	claimId := harness.expect("POST", "/api/v1/copyright/claims", claimantToken, copyrightClaimBody("sound", "s-1"), http.StatusCreated)["claimId"].(string)
	reviewer, stepUp := harness.staff("copyright:review")
	base := "/api/v1/admin/copyright-claims/" + claimId
	harness.expect("POST", base+"/uphold", reviewer, map[string]string{"reason": "matches the master"}, http.StatusOK, stepUp...)
	created := harness.expect("POST", "/api/v1/copyright/claims/"+claimId+"/counter-notices", harness.tokens.SignAccountAccessToken(t, uploader), map[string]any{"statement": "licensed sample", "contactEmail": "me@example.com", "goodFaith": true}, http.StatusCreated)
	back := harness.expect("POST", base+"/counter-notices/"+created["noticeId"].(string)+"/reject", reviewer, map[string]string{"reason": "no licence shown"}, http.StatusOK, stepUp...)
	if back["status"] != "UPHELD" || back["targetFlag"] != "MUTED" || back["remedy"] != "AUDIO_MUTED" {
		t.Fatalf("a rejected counter-notice returns the claim to upheld: %v", back)
	}
}

func ipClaimBody(seller, listing string) map[string]any {
	return map[string]any{
		"kind": "counterfeit", "claimantBrandId": "brand-1", "claimantBrand": map[string]any{"id": "brand-1", "name": "Adire House", "logoUrl": nil, "officialStatus": "OFFICIAL"}, "accusedSellerId": seller, "listingId": listing,
		"listing": map[string]any{"title": "Adire House tee", "price": map[string]any{"amountMinor": 500000, "currency": "NGN"}, "storeName": "Cheap Tees"}, "statement": "These are not our products",
		"evidence": []any{map[string]any{"id": "e1", "kind": "TEST_PURCHASE_PHOTO", "caption": "label differs", "imageUrl": "https://cdn.example/e1"}},
	}
}

func TestCounterfeitClaimsFollowTheStateMachineAndUpholdDelistsAndStrikes(t *testing.T) {
	harness := startModerationAgainstFreshSchema(t)
	seller := uuid.NewString()
	harness.expect("POST", "/api/v1/internal/ip-claims", "", ipClaimBody(seller, "prod-1"), http.StatusUnauthorized)
	harness.expect("POST", "/api/v1/internal/ip-claims", "", map[string]any{"kind": "bogus"}, http.StatusBadRequest, intakeToken...)
	key := append([]string{"Idempotency-Key", "ip-key-1"}, intakeToken...)
	created := harness.expect("POST", "/api/v1/internal/ip-claims", "", ipClaimBody(seller, "prod-1"), http.StatusCreated, key...)
	replay := harness.expect("POST", "/api/v1/internal/ip-claims", "", ipClaimBody(seller, "prod-1"), http.StatusCreated, key...)
	if created["claimId"] != replay["claimId"] {
		t.Fatal("intake is idempotent")
	}
	claimId := created["claimId"].(string)
	reviewer, stepUp := harness.staff("ip-claims:review")
	base := "/api/v1/admin/ip-claims/" + claimId
	detail := harness.expect("GET", base, reviewer, nil, http.StatusOK)
	if detail["status"] != "OPEN" || detail["type"] != "COUNTERFEIT" || len(detail["allowedActions"].([]any)) != 3 || detail["listing"].(map[string]any)["status"] != "LIVE" {
		t.Fatalf("unexpected detail %v", detail)
	}
	harness.expect("POST", base+"/uphold", reviewer, map[string]any{"reason": "clearly counterfeit"}, http.StatusForbidden)
	harness.expect("POST", base+"/request-info", reviewer, map[string]string{"reason": "need the invoice"}, http.StatusOK)
	harness.expect("POST", base+"/request-info", reviewer, map[string]string{"reason": "need the invoice"}, http.StatusConflict)
	sellerToken := harness.tokens.SignAccountAccessToken(t, seller)
	harness.expect("POST", "/api/v1/ip-claims/"+claimId+"/response", harness.tokens.SignAccountAccessToken(t, uuid.NewString()), map[string]string{"statement": "mine"}, http.StatusNotFound)
	harness.expect("POST", "/api/v1/ip-claims/"+claimId+"/response", sellerToken, map[string]string{"statement": "I bought these from the brand's distributor"}, http.StatusNoContent)
	if harness.expect("GET", base, reviewer, nil, http.StatusOK)["sellerResponse"] == nil {
		t.Fatal("the seller response is attached")
	}
	upheld := harness.expect("POST", base+"/uphold", reviewer, map[string]any{"reason": "clearly counterfeit"}, http.StatusOK, stepUp...)
	claim := upheld["claim"].(map[string]any)
	if claim["status"] != "UPHELD" || claim["listing"].(map[string]any)["status"] != "DELISTED" || upheld["sellerStrikeCount"] != float64(1) || upheld["isRepeatInfringer"] != false {
		t.Fatalf("unexpected %v", upheld)
	}
	strikes := harness.expect("GET", "/api/v1/internal/accounts/"+seller+"/strikes", "", nil, http.StatusOK, intakeToken...)["strikes"].([]any)
	if len(strikes) != 1 || strikes[0].(map[string]any)["policy"] != "Counterfeit goods" || strikes[0].(map[string]any)["source"] != "MODERATION" {
		t.Fatalf("unexpected strikes %v", strikes)
	}
	if conflict := harness.expect("POST", base+"/reject", reviewer, map[string]string{"reason": "too late now"}, http.StatusConflict); conflict["code"] != "INVALID_CLAIM_TRANSITION" {
		t.Fatalf("unexpected %v", conflict)
	}
	if !harness.audit.has("ip_claim.uphold") || !harness.waitForPublished("ipClaim.decided") || !harness.waitForPublished("content.visibilityChanged") {
		t.Fatal("audit and events record the decision")
	}

	second := harness.expect("POST", "/api/v1/internal/ip-claims", "", ipClaimBody(seller, "prod-2"), http.StatusCreated, intakeToken...)["claimId"].(string)
	noStrike := harness.expect("POST", "/api/v1/admin/ip-claims/"+second+"/uphold", reviewer, map[string]any{"reason": "counterfeit but first offence", "addStrike": false}, http.StatusOK, stepUp...)
	if noStrike["sellerStrikeCount"] != float64(1) {
		t.Fatalf("addStrike=false skips the strike: %v", noStrike)
	}
}
