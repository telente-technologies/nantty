package users_test

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	checkmarkservices "nantty/modules/users/src/modules/checkmarks/services"
	"nantty/platform/secretbox"
)

func TestBlackInstitutionalEmailOtpEmitsSealedOtpEvent(t *testing.T) {
	otpKey := bytes.Repeat([]byte{9}, 32)
	harness := startUsersModuleAgainstFreshSchemaConfigured(t, func(harness *usersTestHarness) {
		harness.module.Container().Settings.OtpEventKey = otpKey
		harness.module.Container().Settings.OtpEventKeyId = "otp-1"
	})
	accountId, token := harness.newAccount("gov.otp.officer", "Gov Officer")
	gov := harness.expect("POST", "/api/v1/users/me/business-profiles", token, map[string]any{
		"displayName": "Northern Works Agency", "handle": "northern.works.agency", "description": "Official", "businessType": "government", "categories": []map[string]any{{"customName": "Government"}},
	}, http.StatusCreated)
	harness.expect("PUT", "/api/v1/users/me/acting-profile", token, map[string]string{"profileId": gov["id"].(string)}, http.StatusOK)
	created := harness.expect("POST", "/api/v1/verification/black-applications", token, map[string]any{
		"agencyName": "Northern Works Agency", "jurisdictionCountryCode": "NG",
		"institutionalEmail": "otp@works.gov.ng", "representativeName": "Ada Officer", "representativeRole": "Director",
	}, http.StatusCreated)
	appId := uuid.MustParse(created["applicationId"].(string))
	if err := checkmarkservices.EnqueueInstitutionalEmailOtpEvents(context.Background(), harness.module.Container(), appId, uuid.MustParse(accountId), "otp.direct@works.gov.ng", "654321", time.Now().Add(15*time.Minute)); err != nil {
		t.Fatalf("enqueue otp events: %v", err)
	}
	harness.waitForPublishedEvents("blackApplication.institutionalEmailOtpRequested", "otp.issued")
	var payloadRaw []byte
	if err := harness.module.Container().Database.QueryRowContext(context.Background(), `SELECT payload FROM outbox_events WHERE event_type = 'otp.issued' AND payload::text LIKE '%otp.direct@works.gov.ng%' ORDER BY created_at DESC LIMIT 1`).Scan(&payloadRaw); err != nil {
		t.Fatalf("read otp.issued outbox payload: %v", err)
	}
	var envelope struct {
		Data struct {
			Destination string `json:"destination"`
			CodeSealed  string `json:"codeSealed"`
			KeyId       string `json:"keyId"`
		} `json:"data"`
	}
	if err := json.Unmarshal(payloadRaw, &envelope); err != nil {
		t.Fatalf("unmarshal otp.issued: %v", err)
	}
	sealedBytes, err := base64.StdEncoding.DecodeString(envelope.Data.CodeSealed)
	if err != nil {
		t.Fatalf("decode sealed otp: %v", err)
	}
	opened, err := secretbox.OpenWithAesGcm(otpKey, sealedBytes)
	if err != nil || string(opened) != "654321" || envelope.Data.Destination != "otp.direct@works.gov.ng" || envelope.Data.KeyId != "otp-1" {
		t.Fatalf("unexpected sealed otp envelope: opened=%q err=%v env=%+v", string(opened), err, envelope.Data)
	}
}
