package users_test

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"nantty/modules/users/src/generated/ent/verificationcase"
)

func TestRetryableSmileTechnicalErrorReturnsCaseToFreshCapture(t *testing.T) {
	harness, _ := startIdentityVerificationHarness(t, "buy_now", 90)
	_, token := harness.newAccount("retry.capture", "Retry Capture")
	profileID := harness.profileIdOf(token)
	harness.payForBlue(profileID, "sub_retry_capture", "web_checkout")
	container := harness.module.Container()
	row := container.Client.VerificationCase.Query().Where(verificationcase.SubscriptionID("sub_retry_capture")).OnlyX(context.Background())
	caseID, attemptID := harness.captureFor(token, row.ID.String())
	callback, headers := signedSmileV3Callback(caseID, attemptID, "document_verification", "RETRY CAPTURE", "12345678901")
	callback["status"], callback["reason"] = "error", "internal_error"
	result := harness.expect("POST", "/api/v1/webhooks/smile-id", "", callback, http.StatusOK, headers...)
	if result["outcome"] != "retryable" {
		t.Fatalf("documented technical error should allow a fresh capture, got %v", result)
	}
	duplicate := harness.expect("POST", "/api/v1/webhooks/smile-id", "", callback, http.StatusOK, headers...)
	if duplicate["outcome"] != "replayed" {
		t.Fatalf("duplicate technical-error callback should be acknowledged idempotently, got %v", duplicate)
	}
	updated := container.Client.VerificationCase.GetX(context.Background(), row.ID)
	if updated.Status != verificationcase.StatusAwaitingCapture || updated.SmileJobID != nil || updated.SmileUserID != nil || updated.SmileReference == "" || updated.SmileResultCode != "error" {
		t.Fatalf("retryable error must invalidate only the active provider session and retain audit reference: %+v", updated)
	}
	journey := harness.expect("GET", "/api/v1/verification/journey", token, nil, http.StatusOK)
	caseView := journey["case"].(map[string]any)
	if caseView["retryableProviderError"] != true || caseView["canRetry"] != true {
		t.Fatalf("user should be told a fresh attempt is available: %v", caseView)
	}
	newCaseID, newAttemptID := harness.captureFor(token, row.ID.String())
	if newCaseID != caseID || newAttemptID == attemptID {
		t.Fatalf("retry must use a fresh capture attempt: case=%q attempt=%q old=%q", newCaseID, newAttemptID, attemptID)
	}
	stale, staleHeaders := signedSmileV3Callback(caseID, attemptID, "document_verification", "RETRY CAPTURE", "12345678901")
	harness.expect("POST", "/api/v1/webhooks/smile-id", "", stale, http.StatusUnauthorized, staleHeaders...)
}

func TestFailedProviderSessionCreationCanBeRetriedImmediately(t *testing.T) {
	harness, _ := startIdentityVerificationHarness(t, "request", 40)
	_, token := harness.newAccount("femi.ade", "Femi Ade")
	profileID := harness.profileIdOf(token)
	harness.payForBlue(profileID, "sub_femi", "web_checkout")
	container := harness.module.Container()
	row := container.Client.VerificationCase.Query().Where(verificationcase.SubscriptionID("sub_femi")).OnlyX(context.Background())
	capture := container.IdentityCapture.(*fakeCapture)
	capture.setErr(errors.New("provider unavailable"))
	harness.expect("POST", "/api/v1/verification/cases/"+row.ID.String()+"/capture", token, map[string]any{
		"consentVersion": "v1", "consentAccepted": true, "platform": "ios", "documentCountry": "NG", "documentType": "PASSPORT",
	}, http.StatusServiceUnavailable)
	failed := container.Client.VerificationCase.GetX(context.Background(), row.ID)
	if failed.Status != verificationcase.StatusAwaitingCapture || failed.SmileJobID != nil {
		t.Fatalf("failed provider session must release only its attempt marker: %+v", failed)
	}
	capture.setErr(nil)
	_, _ = harness.captureFor(token, row.ID.String())
}
