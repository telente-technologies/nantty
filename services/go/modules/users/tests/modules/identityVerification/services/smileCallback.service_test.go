package services_test

import (
	"reflect"
	"strings"
	"testing"
	"time"

	"entgo.io/ent"

	"nantty/modules/users/src/databases/schema"
	"nantty/modules/users/src/modules/identityVerification/services"
)

const passingCallback = `{
  "signature": "sig", "timestamp": "2026-10-04T10:00:00.000Z", "SmileJobID": "0000123", "ResultCode": "0810", "ResultText": "Document Verified",
  "Country": "NG", "IDType": "NIN_SLIP", "IDNumber": "1234 5678 901", "FullName": "OBI AMAKA GRACE", "DOB": "1994-02-01", "ConfidenceValue": "99.2",
  "Actions": {"Liveness_Check": "Passed", "Verify_Document": "Passed", "Selfie_To_ID_Card_Compare": "Completed", "Verify_ID_Number": "Verified"},
  "ImageLinks": {"selfie_image": "https://smile.example/selfie.jpg", "id_card_image": "https://smile.example/id.jpg"},
  "PartnerParams": {"job_id": "job-1", "user_id": "user-1", "job_type": 11}
}`

func TestParseSmileCallbackMapsActionsToChecks(t *testing.T) {
	envelope, err := services.ParseSmileIdCallback([]byte(passingCallback))
	if err != nil {
		t.Fatal(err)
	}
	result := envelope.Result
	if envelope.JobId != "job-1" || result.Liveness != services.CheckPassed || result.Document != services.CheckPassed || result.FaceMatch != services.CheckPassed || result.DatabaseLookup != services.LookupMatched {
		t.Fatalf("unexpected mapping %+v", result)
	}
	if result.FaceMatchConfidence < 0.99 || result.DocumentType != "NIN_SLIP" || result.DocumentCountry != "NG" || result.SpoofSuspected {
		t.Fatalf("unexpected details %+v", result)
	}
	failed, _ := services.ParseSmileIdCallback([]byte(strings.Replace(passingCallback, `"Liveness_Check": "Passed"`, `"Liveness_Check": "Failed"`, 1)))
	if !failed.Result.SpoofSuspected || failed.Result.Liveness != services.CheckFailed {
		t.Fatalf("a failed liveness check is a spoof signal: %+v", failed.Result)
	}
	if _, err := services.ParseSmileIdCallback([]byte(`{"ResultCode":"0810"}`)); err == nil {
		t.Fatal("a callback without our job id is rejected")
	}
}

func TestDocumentFingerprintIsKeyedAndStable(t *testing.T) {
	envelope, _ := services.ParseSmileIdCallback([]byte(passingCallback))
	first, second := envelope.DocumentFingerprint("key-a"), envelope.DocumentFingerprint("key-a")
	if first == "" || first != second || first == envelope.DocumentFingerprint("key-b") || strings.Contains(first, "12345678901") {
		t.Fatalf("fingerprint must be a stable keyed hash, got %q", first)
	}
	if envelope.DocumentFingerprint("") != "" {
		t.Fatal("no key, no fingerprint")
	}
}

func TestNoBiometricOrRawIdentityDataIsPersisted(t *testing.T) {
	forbidden := []string{"selfie", "image", "photo", "template", "biometric", "embedding", "full_name", "id_number", "dob", "birth", "death", "address", "document_number"}
	for _, entity := range []ent.Interface{schema.VerificationCase{}, schema.VerificationEligibility{}} {
		for _, field := range entity.Fields() {
			name := field.Descriptor().Name
			for _, word := range forbidden {
				if strings.Contains(name, word) {
					t.Fatalf("%T stores %q, which looks like biometric or raw identity data", entity, name)
				}
			}
		}
	}
	resultType := reflect.TypeOf(services.SmileVerificationResult{})
	for index := range resultType.NumField() {
		name := strings.ToLower(resultType.Field(index).Name)
		for _, word := range []string{"image", "selfie", "name", "number", "dob", "link"} {
			if strings.Contains(name, word) {
				t.Fatalf("the stored result carries %s", resultType.Field(index).Name)
			}
		}
	}
}

func TestSmileCallbackMustBeRecentAndBelongToTheCase(t *testing.T) {
	envelope, err := services.ParseSmileIdCallback([]byte(passingCallback))
	if err != nil {
		t.Fatal(err)
	}
	signedAt := time.Date(2026, 10, 4, 10, 0, 0, 0, time.UTC)
	if !envelope.IsFresh(signedAt.Add(10 * time.Minute)) {
		t.Fatal("a callback signed ten minutes ago is accepted")
	}
	if envelope.IsFresh(signedAt.Add(2*time.Hour)) || envelope.IsFresh(signedAt.Add(-time.Hour)) {
		t.Fatal("an old or future-dated signature must not be replayable")
	}
	if !envelope.BelongsTo("USER-1") || envelope.BelongsTo("someone-else") {
		t.Fatal("the echoed user id must match the case owner")
	}
	withoutOwner := envelope
	withoutOwner.UserId = ""
	if withoutOwner.BelongsTo("user-1") {
		t.Fatal("a callback that omits partner_params.user_id must not bind to any case")
	}
	envelope.Timestamp = "not a time"
	if envelope.IsFresh(signedAt) {
		t.Fatal("an unreadable timestamp is rejected")
	}
}
