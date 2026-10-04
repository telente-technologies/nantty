package users

import (
	"context"
	"net/http"
	"sync"
	"testing"
	"time"

	"zudomart/modules/users/src/configs"
	"zudomart/modules/users/src/generated/ent/verificationcase"
	"zudomart/modules/users/src/generated/ent/verificationeligibility"
	"zudomart/modules/users/src/integrations"
	applyentitlement "zudomart/modules/users/src/modules/checkmarks/commands/applyEntitlement"
	identityverification "zudomart/modules/users/src/modules/identityVerification"
	verificationservices "zudomart/modules/users/src/modules/identityVerification/services"
)

type scriptedEligibility struct {
	mutex sync.Mutex
	tier  string
	score int
}

func (fake *scriptedEligibility) set(tier string, score int) {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	fake.tier, fake.score = tier, score
}

func (fake *scriptedEligibility) AssessVerificationEligibility(context.Context, integrations.EligibilitySignals) (integrations.EligibilityAssessment, error) {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	return integrations.EligibilityAssessment{Tier: fake.tier, TrustScore: fake.score, Reasons: []string{"scripted"}, Source: "test"}, nil
}

type fakeCapture struct{}

func (fakeCapture) CreateWebToken(context.Context, string, string, string) (string, error) {
	return "web-token", nil
}

func (fakeCapture) CreateSmileLink(context.Context, integrations.SmileLinkRequest) (string, error) {
	return "https://links.smileidentity.test/abc", nil
}

func (harness *usersTestHarness) enableIdentityVerification() *scriptedEligibility {
	eligibility := &scriptedEligibility{tier: "request", score: 40}
	container := harness.module.Container()
	container.Settings.Verification = configs.IdentityVerificationSettings{SmileIdPartnerId: "partner-1", SmileIdApiKey: "api-key", ConsentVersion: "v1", DocumentFingerprintKey: "fingerprint-key", EligibilityRecheckEvery: time.Hour, WebAppBaseUrl: "https://zudomart.test"}
	container.IdentityCapture, container.Eligibility = fakeCapture{}, eligibility
	return eligibility
}

func signedSmileCallback(jobId, fullName, liveness, idNumber string) map[string]any {
	timestamp := time.Now().UTC().Format(time.RFC3339Nano)
	return map[string]any{
		"signature": integrations.ComputeSmileIdSignature("api-key", "partner-1", timestamp), "timestamp": timestamp, "SmileJobID": "smile-" + jobId, "ResultCode": "0810",
		"Country": "NG", "IDType": "NIN_SLIP", "IDNumber": idNumber, "FullName": fullName, "ConfidenceValue": "99",
		"Actions":       map[string]string{"Liveness_Check": liveness, "Verify_Document": "Passed", "Selfie_To_ID_Card_Compare": "Completed", "Verify_ID_Number": "Verified"},
		"ImageLinks":    map[string]string{"selfie_image": "https://smile.test/selfie.jpg"},
		"PartnerParams": map[string]any{"job_id": jobId, "user_id": "u", "job_type": 11},
	}
}

func (harness *usersTestHarness) payForBlue(profileId, subscriptionId, channel string) {
	harness.t.Helper()
	err := applyentitlement.Handler{Container: harness.module.Container()}.Execute(context.Background(), applyentitlement.Command{
		EventType: "entitlement.granted", SubscriptionId: subscriptionId, ProfileId: profileId, Plan: "blue", Checkmark: "blue", Status: "active", Channel: channel,
	})
	if err != nil {
		harness.t.Fatal(err)
	}
}

func (harness *usersTestHarness) captureFor(token, caseId string) string {
	harness.t.Helper()
	harness.expect("POST", "/api/v1/verification/cases/"+caseId+"/capture", token, map[string]any{"consentVersion": "v1", "consentAccepted": false, "platform": "ios", "documentCountry": "NG", "documentType": "NIN_SLIP"}, http.StatusBadRequest)
	session := harness.expect("POST", "/api/v1/verification/cases/"+caseId+"/capture", token, map[string]any{"consentVersion": "v1", "consentAccepted": true, "platform": "ios", "documentCountry": "NG", "documentType": "NIN_SLIP"}, http.StatusOK)
	if session["mode"] != "hosted_link" || session["url"] == "" {
		harness.t.Fatalf("unexpected capture session %v", session)
	}
	return session["jobId"].(string)
}

func TestIdentityVerificationJourneyFromRequestToAutoApproval(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	eligibility := harness.enableIdentityVerification()
	_, token := harness.newAccount("amaka.obi", "Amaka Grace Obi")
	profileId := harness.profileIdOf(token)
	journey := harness.expect("GET", "/api/v1/verification/journey", token, nil, http.StatusOK)
	if journey["color"] != "blue" || journey["eligibility"].(map[string]any)["canBuyNow"] != false {
		t.Fatalf("a low-trust account is offered Request, not Buy now: %v", journey)
	}
	if harness.expect("POST", "/api/v1/verification/eligibility/request", token, nil, http.StatusOK)["state"] != "requested" {
		t.Fatal("the request is queued")
	}
	eligibility.set("buy_now", 85)
	container := harness.module.Container()
	if err := container.Client.VerificationEligibility.Update().Where(verificationeligibility.StateEQ(verificationeligibility.StateRequested)).SetNextCheckAt(time.Now().Add(-time.Minute)).Exec(context.Background()); err != nil {
		t.Fatal(err)
	}
	if _, became := verificationservices.RecheckQueuedEligibilityOnce(context.Background(), container, 10); became != 1 {
		t.Fatal("the scheduled recheck makes the account eligible")
	}
	harness.waitForPublishedEvents("verification.eligible")

	harness.payForBlue(profileId, "sub_amaka", "web_paystack")
	harness.payForBlue(profileId, "sub_amaka", "web_paystack")
	cases := container.Client.VerificationCase.Query().Where(verificationcase.SubscriptionID("sub_amaka")).AllX(context.Background())
	if len(cases) != 1 || cases[0].Status != verificationcase.StatusAwaitingConsent || !cases[0].EligibleAtPayment {
		t.Fatalf("payment opens exactly one case: %+v", cases)
	}
	if harness.expect("GET", "/api/v1/verification/journey", token, nil, http.StatusOK)["checkmark"] != nil {
		t.Fatal("no badge before the identity check")
	}
	jobId := harness.captureFor(token, cases[0].ID.String())
	forged := signedSmileCallback(jobId, "OBI AMAKA GRACE", "Passed", "12345678901")
	forged["signature"] = "forged"
	harness.expect("POST", "/api/v1/webhooks/smile-id", "", forged, http.StatusUnauthorized)
	callback := signedSmileCallback(jobId, "OBI AMAKA GRACE", "Passed", "12345678901")
	if harness.expect("POST", "/api/v1/webhooks/smile-id", "", callback, http.StatusOK)["outcome"] != "approved" {
		t.Fatal("a clean result auto-approves")
	}
	if harness.expect("POST", "/api/v1/webhooks/smile-id", "", callback, http.StatusOK)["outcome"] != "replayed" {
		t.Fatal("a replayed callback is a no-op")
	}
	approved := container.Client.VerificationCase.GetX(context.Background(), cases[0].ID)
	if approved.Status != verificationcase.StatusApproved || approved.CallbackCount != 2 || approved.DocumentFingerprint == "" || approved.VerifiedAt == nil {
		t.Fatalf("unexpected approved case %+v", approved)
	}
	mark := harness.expect("GET", "/api/v1/verification/journey", token, nil, http.StatusOK)["checkmark"].(map[string]any)
	if mark["badgeVisible"] != true {
		t.Fatalf("the badge is granted: %v", mark)
	}
	harness.waitForPublishedEvents("verification.approved", "verificationCase.decided")
}

func TestRejectedVerificationRequestsARefund(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	eligibility := harness.enableIdentityVerification()
	eligibility.set("buy_now", 90)
	_, token := harness.newAccount("tobi.ade", "Tobi Adeyemi")
	profileId := harness.profileIdOf(token)
	harness.expect("GET", "/api/v1/verification/journey", token, nil, http.StatusOK)
	harness.payForBlue(profileId, "sub_tobi", "apple_iap")
	container := harness.module.Container()
	row := container.Client.VerificationCase.Query().Where(verificationcase.SubscriptionID("sub_tobi")).OnlyX(context.Background())
	jobId := harness.captureFor(token, row.ID.String())
	if harness.expect("POST", "/api/v1/webhooks/smile-id", "", signedSmileCallback(jobId, "IBRAHIM MUSA", "Passed", "999"), http.StatusOK)["outcome"] != "under_review" {
		t.Fatal("a name mismatch goes to review")
	}
	harness.waitForPublishedEvents("verification.underReview", "verification.fraudSignalDetected")
	staffToken, stepUp := harness.staffHeaders("verification:review")
	harness.expect("POST", "/api/v1/admin/verification-cases/"+row.ID.String()+"/reject", staffToken, map[string]any{"reason": "The ID belongs to someone else."}, http.StatusForbidden)
	rejected := harness.expect("POST", "/api/v1/admin/verification-cases/"+row.ID.String()+"/reject", staffToken, map[string]any{"reason": "The ID belongs to someone else."}, http.StatusOK, stepUp...)
	if rejected["status"] != "rejected" || rejected["refundStatus"] != "requested" || rejected["refundMethod"] != "apple_request" {
		t.Fatalf("unexpected rejection %v", rejected)
	}
	harness.waitForPublishedEvents("verificationCase.refundRequested", "verification.rejectedRefunded")
	if err := identityverification.HandleIdentityEvent(context.Background(), container, "verificationRefund.manualStoreRefundRequired", []byte(`{"caseId":"`+row.ID.String()+`"}`)); err != nil {
		t.Fatal(err)
	}
	if container.Client.VerificationCase.GetX(context.Background(), row.ID).RefundStatus != verificationcase.RefundStatusManualStoreRefund {
		t.Fatal("the refund outcome is recorded on the case")
	}
}
