package users_test

import (
	"context"
	"net/http"
	"slices"
	"sync"
	"testing"
	"time"

	"nantty/modules/users/src/configs"
	"nantty/modules/users/src/generated/ent/verificationcase"
	"nantty/modules/users/src/generated/ent/verificationeligibility"
	"nantty/modules/users/src/integrations"
	applyentitlement "nantty/modules/users/src/modules/checkmarks/commands/applyEntitlement"
	identityverification "nantty/modules/users/src/modules/identityVerification"
	verificationservices "nantty/modules/users/src/modules/identityVerification/services"
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

type fakeCapture struct {
	mutex sync.Mutex
	err   error
}

func (fake *fakeCapture) setErr(err error) {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	fake.err = err
}

func (fake *fakeCapture) currentErr() error {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	return fake.err
}

func (fake *fakeCapture) CreateWebToken(context.Context, integrations.SmileIdCaptureRequest) (string, error) {
	if err := fake.currentErr(); err != nil {
		return "", err
	}
	return "web-token", nil
}

func (fake *fakeCapture) CreateSmileLink(context.Context, integrations.SmileIdCaptureRequest) (string, error) {
	if err := fake.currentErr(); err != nil {
		return "", err
	}
	return "https://links.smileidentity.test/abc", nil
}

func (*fakeCapture) SupportedDocuments(_ context.Context, country string) ([]integrations.SmileIdDocumentCountry, error) {
	var documents integrations.SmileIdDocumentCountry
	documents.Country.Code, documents.Country.Name = country, "Test country"
	documents.IDTypes = []integrations.SmileIdDocumentType{{Code: "PASSPORT", Name: "Passport"}}
	return []integrations.SmileIdDocumentCountry{documents}, nil
}

func (*fakeCapture) SupportedKycTypes(_ context.Context, country string) ([]integrations.SmileIdSupportedKycType, error) {
	return []integrations.SmileIdSupportedKycType{{Country: country, Type: "NIN_V2", Label: "NIN"}}, nil
}

func (*fakeCapture) EnhancedDocumentEntitlements(context.Context) (map[string][]string, error) {
	return map[string][]string{"NG": {"VOTER_ID"}}, nil
}

func startIdentityVerificationHarness(t *testing.T, tier string, score int) (*usersTestHarness, *scriptedEligibility) {
	t.Helper()
	eligibility := &scriptedEligibility{tier: tier, score: score}
	capture := &fakeCapture{}
	harness := startUsersModuleAgainstFreshSchemaConfigured(t, func(h *usersTestHarness) {
		container := h.module.Container()
		container.Settings.Verification = configs.IdentityVerificationSettings{SmileIdPartnerId: "partner-1", SmileIdApiKey: "api-key", SmileIdEnabledProducts: []string{"document_verification", "enhanced_kyc"}, SmileIdEnabledDocumentTypes: []string{"NG:PASSPORT"}, SmileIdEnabledIdNumberTypes: []string{"NG:NIN_V2"}, ConsentVersion: "v1", PrivacyPolicyUrl: "https://nantty.test/privacy", DocumentFingerprintKey: "fingerprint-key", EligibilityRecheckEvery: time.Hour, WebAppBaseUrl: "https://nantty.test"}
		container.IdentityCapture, container.Eligibility = capture, eligibility
	})
	return harness, eligibility
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

func (harness *usersTestHarness) captureFor(token, caseId string) (string, string) {
	harness.t.Helper()
	harness.expect("POST", "/api/v1/verification/cases/"+caseId+"/capture", token, map[string]any{"consentVersion": "v1", "consentAccepted": false, "platform": "ios", "documentCountry": "NG", "documentType": "PASSPORT"}, http.StatusBadRequest)
	session := harness.expect("POST", "/api/v1/verification/cases/"+caseId+"/capture", token, map[string]any{"consentVersion": "v1", "consentAccepted": true, "platform": "ios", "documentCountry": "NG", "documentType": "PASSPORT"}, http.StatusOK)
	if session["mode"] != "hosted_link" || session["url"] == "" {
		harness.t.Fatalf("unexpected capture session %v", session)
	}
	return session["caseId"].(string), session["captureAttemptId"].(string)
}

func (harness *usersTestHarness) captureNinFor(token, caseId string) (string, string) {
	harness.t.Helper()
	session := harness.expect("POST", "/api/v1/verification/cases/"+caseId+"/capture", token, map[string]any{
		"consentVersion": "v1", "consentAccepted": true, "platform": "ios", "verificationMethod": "id_number",
		"verificationProduct": "enhanced_kyc", "documentCountry": "NG", "documentType": "NIN_V2",
	}, http.StatusOK)
	if session["mode"] != "hosted_link" || session["url"] == "" {
		harness.t.Fatalf("unexpected NIN capture session %v", session)
	}
	return session["caseId"].(string), session["captureAttemptId"].(string)
}

func signedSmileV3Callback(caseId, captureAttemptId, product, fullName, idNumber string) (map[string]any, []string) {
	timestamp := time.Now().UTC().Format(time.RFC3339Nano)
	jobId := "smile-job-" + caseId
	idFields := map[string]string{"full_name": fullName}
	userProvidedInfo := map[string]string{}
	if product == "enhanced_kyc" {
		userProvidedInfo["id_number"] = idNumber
	} else {
		idFields["id_number"], idFields["country"], idFields["id_type"] = idNumber, "NG", "PASSPORT"
	}
	body := map[string]any{
		"status": "clear", "product": product, "partner_params": map[string]string{"nantty_case_id": caseId, "capture_attempt_id": captureAttemptId},
		"id_fields": idFields, "user_provided_info": userProvidedInfo,
		"antifraud": map[string]any{"summary": map[string]any{"fraud_detected": false}, "smile_secure": map[string]string{"status": "clear"}},
	}
	return body, []string{
		"Response-Signature", integrations.ComputeSmileIdSignature("api-key", "partner-1", timestamp),
		"Response-Timestamp", timestamp, "smileid-job-id", jobId, "user-id", integrations.SmileIdUserIDForCaptureAttempt(captureAttemptId),
	}
}

func TestIdentityVerificationJourneyFromRequestToAutoApproval(t *testing.T) {
	harness, eligibility := startIdentityVerificationHarness(t, "request", 40)
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

	harness.payForBlue(profileId, "sub_amaka", "web_checkout")
	harness.payForBlue(profileId, "sub_amaka", "web_checkout")
	cases := container.Client.VerificationCase.Query().Where(verificationcase.SubscriptionID("sub_amaka")).AllX(context.Background())
	if len(cases) != 1 || cases[0].Status != verificationcase.StatusAwaitingConsent || !cases[0].EligibleAtPayment {
		t.Fatalf("payment opens exactly one case: %+v", cases)
	}
	if harness.expect("GET", "/api/v1/verification/journey", token, nil, http.StatusOK)["checkmark"] != nil {
		t.Fatal("no badge before the identity check")
	}
	caseId, captureAttemptId := harness.captureFor(token, cases[0].ID.String())
	callback, callbackHeaders := signedSmileV3Callback(caseId, captureAttemptId, "document_verification", "OBI AMAKA GRACE", "12345678901")
	delete(callback, "partner_params") // The documented callback object is nullable.
	if stored := container.Client.VerificationCase.GetX(context.Background(), cases[0].ID).SmileUserID; stored == nil || *stored != callbackHeaders[len(callbackHeaders)-1] {
		t.Fatal("new capture attempts must persist the exact provider user ID used for callback fallback")
	}
	forgedHeaders := append([]string(nil), callbackHeaders...)
	forgedHeaders[1] = "forged"
	harness.expect("POST", "/api/v1/webhooks/smile-id", "", callback, http.StatusUnauthorized, forgedHeaders...)
	if harness.expect("POST", "/api/v1/webhooks/smile-id", "", callback, http.StatusOK, callbackHeaders...)["outcome"] != "approved" {
		t.Fatal("a clean result auto-approves")
	}
	if harness.expect("POST", "/api/v1/webhooks/smile-id", "", callback, http.StatusOK, callbackHeaders...)["outcome"] != "replayed" {
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

func TestEnhancedKycNinUsesTransientSubmittedNumberAndStoredTypeForFingerprint(t *testing.T) {
	harness, eligibility := startIdentityVerificationHarness(t, "request", 40)
	_, token := harness.newAccount("amaka.nin", "Amaka Grace Obi")
	harness.expect("GET", "/api/v1/verification/journey", token, nil, http.StatusOK)
	harness.expect("POST", "/api/v1/verification/eligibility/request", token, nil, http.StatusOK)
	eligibility.set("buy_now", 85)
	container := harness.module.Container()
	if err := container.Client.VerificationEligibility.Update().Where(verificationeligibility.StateEQ(verificationeligibility.StateRequested)).SetNextCheckAt(time.Now().Add(-time.Minute)).Exec(context.Background()); err != nil {
		t.Fatal(err)
	}
	if _, became := verificationservices.RecheckQueuedEligibilityOnce(context.Background(), container, 10); became != 1 {
		t.Fatal("the scheduled recheck makes the account eligible")
	}
	profileID := harness.profileIdOf(token)
	harness.payForBlue(profileID, "sub_amaka_nin", "web_checkout")
	row := container.Client.VerificationCase.Query().Where(verificationcase.SubscriptionID("sub_amaka_nin")).OnlyX(context.Background())
	caseID, attemptID := harness.captureNinFor(token, row.ID.String())
	callback, callbackHeaders := signedSmileV3Callback(caseID, attemptID, "enhanced_kyc", "AMAKA GRACE OBI", "12345678901")
	if result := harness.expect("POST", "/api/v1/webhooks/smile-id", "", callback, http.StatusOK, callbackHeaders...); result["outcome"] != "approved" {
		updated := container.Client.VerificationCase.GetX(context.Background(), row.ID)
		t.Fatalf("clear Enhanced KYC result should use the valid authority match: response=%v reasons=%v score=%f eligible_at_payment=%t", result, updated.DecisionReasons, updated.NameMatchScore, updated.EligibleAtPayment)
	}
	verified := container.Client.VerificationCase.GetX(context.Background(), row.ID)
	if verified.DocumentFingerprint == "" || verified.DocumentCountry != "NG" || verified.DocumentType != "NIN_V2" {
		t.Fatalf("NIN fingerprint must use the transient submitted value and case-selected identity scope: %+v", verified)
	}
}

func TestSmileCallbackIdentityMismatchRequiresReviewAndPreservesCaptureSelection(t *testing.T) {
	harness, eligibility := startIdentityVerificationHarness(t, "request", 40)
	_, token := harness.newAccount("amaka.nin-mismatch", "Amaka Grace Obi")
	harness.expect("GET", "/api/v1/verification/journey", token, nil, http.StatusOK)
	harness.expect("POST", "/api/v1/verification/eligibility/request", token, nil, http.StatusOK)
	eligibility.set("buy_now", 85)
	container := harness.module.Container()
	if err := container.Client.VerificationEligibility.Update().Where(verificationeligibility.StateEQ(verificationeligibility.StateRequested)).SetNextCheckAt(time.Now().Add(-time.Minute)).Exec(context.Background()); err != nil {
		t.Fatal(err)
	}
	if _, became := verificationservices.RecheckQueuedEligibilityOnce(context.Background(), container, 10); became != 1 {
		t.Fatal("the scheduled recheck makes the account eligible")
	}
	profileID := harness.profileIdOf(token)
	harness.payForBlue(profileID, "sub_amaka_nin_mismatch", "web_checkout")
	row := container.Client.VerificationCase.Query().Where(verificationcase.SubscriptionID("sub_amaka_nin_mismatch")).OnlyX(context.Background())
	caseID, attemptID := harness.captureNinFor(token, row.ID.String())
	body, headers := signedSmileV3Callback(caseID, attemptID, "enhanced_kyc", "AMAKA GRACE OBI", "12345678901")
	body["id_fields"] = map[string]string{"full_name": "AMAKA GRACE OBI", "country": "US", "id_type": "PASSPORT"}
	result := harness.expect("POST", "/api/v1/webhooks/smile-id", "", body, http.StatusOK, headers...)
	if result["outcome"] != "under_review" {
		t.Fatalf("a provider identity mismatch must not approve: %v", result)
	}
	updated := container.Client.VerificationCase.GetX(context.Background(), row.ID)
	if updated.Status != verificationcase.StatusUnderReview || updated.DocumentCountry != "NG" || updated.DocumentType != "NIN_V2" || !slices.Contains(updated.DecisionReasons, "provider_identity_type_mismatch") {
		t.Fatalf("callback mismatch must preserve the capture selection and record review: %+v", updated)
	}
}

func TestRejectedVerificationRequestsARefund(t *testing.T) {
	harness, _ := startIdentityVerificationHarness(t, "buy_now", 90)
	_, token := harness.newAccount("tobi.ade", "Tobi Adeyemi")
	profileId := harness.profileIdOf(token)
	harness.expect("GET", "/api/v1/verification/journey", token, nil, http.StatusOK)
	harness.payForBlue(profileId, "sub_tobi", "apple_iap")
	container := harness.module.Container()
	row := container.Client.VerificationCase.Query().Where(verificationcase.SubscriptionID("sub_tobi")).OnlyX(context.Background())
	caseId, captureAttemptId := harness.captureFor(token, row.ID.String())
	callback, callbackHeaders := signedSmileV3Callback(caseId, captureAttemptId, "document_verification", "IBRAHIM MUSA", "999")
	if harness.expect("POST", "/api/v1/webhooks/smile-id", "", callback, http.StatusOK, callbackHeaders...)["outcome"] != "under_review" {
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
