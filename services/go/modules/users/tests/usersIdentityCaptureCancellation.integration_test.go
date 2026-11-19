package users_test

import (
	"context"
	"net/http"
	"testing"

	"nantty/modules/users/src/generated/ent/verificationcase"
)

func TestCancelledWebSdkCaptureCanBeRetriedWithoutWaitingForSessionExpiry(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	harness.enableIdentityVerification()
	_, token := harness.newAccount("sade.ade", "Sade Ade")
	profileID := harness.profileIdOf(token)
	harness.payForBlue(profileID, "sub_sade", "web_checkout")
	container := harness.module.Container()
	row := container.Client.VerificationCase.Query().Where(verificationcase.SubscriptionID("sub_sade")).OnlyX(context.Background())
	path := "/api/v1/verification/cases/" + row.ID.String()
	session := harness.expect("POST", path+"/capture", token, map[string]any{
		"consentVersion": "v1", "consentAccepted": true, "platform": "web", "verificationMethod": "document", "documentCountry": "NG", "documentType": "PASSPORT",
	}, http.StatusOK)
	attemptID := session["captureAttemptId"].(string)

	_, otherToken := harness.newAccount("kemi.ade", "Kemi Ade")
	harness.expect("POST", path+"/capture/cancel", otherToken, map[string]any{"captureAttemptId": attemptID}, http.StatusNotFound)
	harness.expect("POST", path+"/capture/cancel", token, map[string]any{"captureAttemptId": "00000000-0000-4000-8000-000000000000"}, http.StatusConflict)
	if result := harness.expect("POST", path+"/capture/cancel", token, map[string]any{"captureAttemptId": attemptID}, http.StatusOK); result["cancelled"] != true {
		t.Fatalf("the matching web attempt should be released: %v", result)
	}
	cancelled := container.Client.VerificationCase.GetX(context.Background(), row.ID)
	if cancelled.Status != verificationcase.StatusAwaitingConsent || cancelled.ConsentAt != nil || cancelled.SmileJobID != nil {
		t.Fatalf("cancellation must clear only the active, unsubmitted attempt: %+v", cancelled)
	}
	harness.expect("POST", path+"/capture/cancel", token, map[string]any{"captureAttemptId": attemptID}, http.StatusConflict)
	retry := harness.expect("POST", path+"/capture", token, map[string]any{
		"consentVersion": "v1", "consentAccepted": true, "platform": "web", "verificationMethod": "document", "documentCountry": "NG", "documentType": "PASSPORT",
	}, http.StatusOK)
	if retry["captureAttemptId"] == attemptID {
		t.Fatal("retry must issue a fresh capture attempt identifier")
	}
}
