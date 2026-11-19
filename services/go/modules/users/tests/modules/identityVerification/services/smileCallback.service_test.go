package services_test

import (
	"reflect"
	"slices"
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

func TestParseSmileV3CallbackUsesHeadersAndConservativeStatusMapping(t *testing.T) {
	clear := []byte(`{"status":"clear","product":"enhanced_document_verification","partner_params":{"nantty_case_id":"00000000-0000-4000-8000-000000000001","capture_attempt_id":"attempt-1"},"id_fields":{"full_name":"OBI AMAKA GRACE","id_number":"1234 5678 901","country":"NG","id_type":"NIN_SLIP"},"antifraud":{"summary":{"fraud_detected":false},"smile_secure":{"status":"clear"}}}`)
	envelope, err := services.ParseSmileIdV3Callback(clear, "provider-job-1", "provider-user-1")
	if err != nil {
		t.Fatal(err)
	}
	if !envelope.IsV3 || envelope.CaseId != "00000000-0000-4000-8000-000000000001" || envelope.CaptureAttemptID != "attempt-1" || envelope.JobId != "provider-job-1" || envelope.UserId != "provider-user-1" || envelope.Result.SmileJobId != "provider-job-1" {
		t.Fatalf("V3 header and case correlation were not retained: %+v", envelope)
	}
	if envelope.Result.Liveness != services.CheckPassed || envelope.Result.Document != services.CheckPassed || envelope.Result.FaceMatch != services.CheckPassed || envelope.Result.DatabaseLookup != services.LookupMatched {
		t.Fatalf("clear enhanced document result was not mapped: %+v", envelope.Result)
	}
	if envelope.DocumentFingerprint("key") == "" || envelope.FullName != "OBI AMAKA GRACE" {
		t.Fatal("V3 identity fields must remain transiently available for scoring and fingerprinting")
	}
	deceased := []byte(strings.Replace(string(clear), `"id_type":"NIN_SLIP"`, `"id_type":"NIN_SLIP","is_deceased":true`, 1))
	deceasedEnvelope, err := services.ParseSmileIdV3Callback(deceased, "provider-job-deceased-edv", "provider-user-1")
	if err != nil || !deceasedEnvelope.Result.Deceased {
		t.Fatalf("Enhanced Document Verification deceased indicator must be captured transiently: %+v, %v", deceasedEnvelope, err)
	}
	attention := []byte(strings.Replace(string(clear), `"clear"`, `"attention"`, 1))
	attentionEnvelope, err := services.ParseSmileIdV3Callback(attention, "provider-job-2", "provider-user-1")
	if err != nil || attentionEnvelope.Result.Liveness != services.CheckReview || attentionEnvelope.Result.Document != services.CheckReview {
		t.Fatalf("attention must remain reviewable, got %+v, %v", attentionEnvelope, err)
	}
	if _, err := services.ParseSmileIdV3Callback(clear, "", "provider-user-1"); err == nil {
		t.Fatal("a V3 callback without the provider job ID header must be rejected")
	}
	unsupported := []byte(strings.Replace(string(clear), "enhanced_document_verification", "unexpected_product", 1))
	if _, err := services.ParseSmileIdV3Callback(unsupported, "provider-job-unsupported", "provider-user-1"); err == nil {
		t.Fatal("unknown Smile products must not inherit Document Verification check semantics")
	}
}

func TestParseSmileV3RetainsOnlyDocumentedMachineReasonCodes(t *testing.T) {
	body := `{"status":"error","reason":"service_unavailable","product":"enhanced_kyc","partner_params":{"nantty_case_id":"00000000-0000-4000-8000-000000000001"},"id_fields":null}`
	envelope, err := services.ParseSmileIdV3Callback([]byte(body), "provider-job-reason", "provider-user-reason")
	if err != nil || envelope.Result.ProviderReasonCode != "service_unavailable" || envelope.Result.ProviderReasonUnrecognized {
		t.Fatalf("documented machine reason should be retained as a bounded code: %+v, %v", envelope.Result, err)
	}
	unknown := strings.Replace(body, "service_unavailable", "unexpected-sensitive-provider-text", 1)
	envelope, err = services.ParseSmileIdV3Callback([]byte(unknown), "provider-job-unknown-reason", "provider-user-reason")
	if err != nil || envelope.Result.ProviderReasonCode != "" || !envelope.Result.ProviderReasonUnrecognized {
		t.Fatalf("unknown provider reason must not be retained verbatim: %+v, %v", envelope.Result, err)
	}
}

func TestParseSmileV3AcceptsDocumentedMixedPartnerParamsAndNullableResults(t *testing.T) {
	body := []byte(`{"status":"error","message":"Provider detail is not persisted","reason":"service_unavailable","product":"enhanced_document_verification","partner_params":{"job_id":"job-1","user_id":"user-1","job_type":11,"nantty_case_id":"00000000-0000-4000-8000-000000000001","capture_attempt_id":"attempt-1"},"id_fields":null,"antifraud":null}`)
	envelope, err := services.ParseSmileIdV3Callback(body, "provider-job-1", "provider-user-1")
	if err != nil {
		t.Fatal(err)
	}
	if envelope.CaseId != "00000000-0000-4000-8000-000000000001" || envelope.CaptureAttemptID != "attempt-1" || envelope.Result.ProviderReasonCode != "service_unavailable" {
		t.Fatalf("documented callback metadata was not parsed: %+v", envelope)
	}
}

func TestParseSmileV3AcceptsMissingNullablePartnerParamsForExactUserCorrelation(t *testing.T) {
	for _, body := range []string{
		`{"status":"error","reason":"service_unavailable","product":"document_verification","partner_params":null,"id_fields":null,"antifraud":null}`,
		`{"status":"error","reason":"service_unavailable","product":"document_verification","id_fields":null}`,
		`{"status":"error","reason":"service_unavailable","product":"document_verification","partner_params":{"nantty_case_id": null, "capture_attempt_id": null}}`,
	} {
		envelope, err := services.ParseSmileIdV3Callback([]byte(body), "provider-job-1", "nantty-capture-00000000-0000-4000-8000-000000000001")
		if err != nil {
			t.Fatalf("nullable partner_params should be accepted when provider user ID is available: %v", err)
		}
		if envelope.CaseId != "" || envelope.CaptureAttemptID != "" || envelope.UserId == "" {
			t.Fatalf("missing partner params must leave correlation to the exact stored provider user ID: %+v", envelope)
		}
	}
}

func TestSmileResultMatchesSelectedIdentity(t *testing.T) {
	tests := []struct {
		name    string
		result  services.SmileVerificationResult
		country string
		idType  string
		want    bool
	}{
		{name: "matching provider values", result: services.SmileVerificationResult{DocumentCountry: "NG", DocumentType: "NIN_SLIP"}, country: "NG", idType: "NIN_SLIP", want: true},
		{name: "provider may omit nullable identity values", result: services.SmileVerificationResult{}, country: "NG", idType: "NIN_V2", want: true},
		{name: "country comparison ignores case and surrounding whitespace", result: services.SmileVerificationResult{DocumentCountry: " ng ", DocumentType: " passport "}, country: "NG", idType: "PASSPORT", want: true},
		{name: "country mismatch", result: services.SmileVerificationResult{DocumentCountry: "US", DocumentType: "PASSPORT"}, country: "NG", idType: "PASSPORT", want: false},
		{name: "document type mismatch", result: services.SmileVerificationResult{DocumentCountry: "NG", DocumentType: "VOTER_ID"}, country: "NG", idType: "PASSPORT", want: false},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			if got := services.SmileResultMatchesSelection(testCase.result, testCase.country, testCase.idType); got != testCase.want {
				t.Fatalf("SmileResultMatchesSelection() = %v, want %v", got, testCase.want)
			}
		})
	}
}

func TestSmileV3IdentityFieldsAreComparedWithoutPrefixTruncation(t *testing.T) {
	base := `{"status":"clear","product":"document_verification","partner_params":{"nantty_case_id":"00000000-0000-4000-8000-000000000001"},"id_fields":{"country":"NG","id_type":"PASSPORT"}}`
	malformedCountry := strings.Replace(base, `"country":"NG"`, `"country":"NG-extra"`, 1)
	envelope, err := services.ParseSmileIdV3Callback([]byte(malformedCountry), "job-1", "user-1")
	if err != nil {
		t.Fatal(err)
	}
	if services.SmileResultMatchesSelection(envelope.Result, "NG", "PASSPORT") {
		t.Fatal("an overlong country value must not be truncated into a valid selected country")
	}

	longType := strings.Repeat("A", 41)
	malformedType := strings.Replace(base, `"id_type":"PASSPORT"`, `"id_type":"`+longType+`"`, 1)
	envelope, err = services.ParseSmileIdV3Callback([]byte(malformedType), "job-2", "user-1")
	if err != nil {
		t.Fatal(err)
	}
	if envelope.Result.DocumentType != longType || services.SmileResultMatchesSelection(envelope.Result, "NG", strings.Repeat("A", 40)) {
		t.Fatal("an overlong ID type must be compared in full instead of matching its truncated prefix")
	}
}

func TestParseSmileV3RejectsNonStringCorrelationMetadata(t *testing.T) {
	body := []byte(`{"status":"clear","product":"document_verification","partner_params":{"nantty_case_id":123}}`)
	if _, err := services.ParseSmileIdV3Callback(body, "provider-job-1", "provider-user-1"); err == nil {
		t.Fatal("case correlation must be a string")
	}
}

func TestParseEnhancedKycDoesNotClaimSelfieOrDocumentChecks(t *testing.T) {
	body := []byte(`{"status":"clear","product":"enhanced_kyc","partner_params":{"nantty_case_id":"00000000-0000-4000-8000-000000000001"},"id_fields":{"full_name":"OBI AMAKA GRACE"},"user_provided_info":{"id_number":"12345678901"},"antifraud":{"summary":{"fraud_detected":false},"smile_secure":{"status":"clear"}}}`)
	envelope, err := services.ParseSmileIdV3Callback(body, "provider-job-nin", "provider-user-nin")
	if err != nil {
		t.Fatal(err)
	}
	if envelope.Result.Liveness != services.CheckNotDone || envelope.Result.Document != services.CheckNotDone || envelope.Result.FaceMatch != services.CheckNotDone || envelope.Result.DatabaseLookup != services.LookupMatched {
		t.Fatalf("Enhanced KYC must only assert its authoritative ID-number lookup: %+v", envelope.Result)
	}
	fingerprint := envelope.DocumentFingerprintFor("key", "NG", "NIN_V2")
	if fingerprint == "" || fingerprint == envelope.DocumentFingerprintFor("key", "NG", "BVN") {
		t.Fatal("the submitted NIN must be transiently fingerprinted with the selected country and ID type")
	}
	attention := strings.Replace(string(body), `"status":"clear"`, `"status":"attention"`, 1)
	attentionEnvelope, err := services.ParseSmileIdV3Callback([]byte(attention), "provider-job-attention", "provider-user-nin")
	if err != nil || attentionEnvelope.DocumentFingerprintFor("key", "NG", "NIN_V2") != "" {
		t.Fatalf("unconfirmed ID number must not be used as a verified NIN fingerprint: %+v, %v", attentionEnvelope.Result, err)
	}
	deceased := []byte(strings.Replace(string(body), `"id_fields":{"full_name":"OBI AMAKA GRACE"}`, `"id_fields":{"full_name":"OBI AMAKA GRACE","is_deceased":true}`, 1))
	deceasedEnvelope, err := services.ParseSmileIdV3Callback(deceased, "provider-job-deceased", "provider-user-nin")
	if err != nil || !deceasedEnvelope.Result.Deceased {
		t.Fatalf("the authority deceased indicator must be captured transiently: %+v, %v", deceasedEnvelope.Result, err)
	}
}

func TestSmileV3ProviderRiskIsNotMislabelledAsSpoofAndRequiresReview(t *testing.T) {
	body := []byte(`{"status":"clear","product":"document_verification","partner_params":{"nantty_case_id":"00000000-0000-4000-8000-000000000001"},"id_fields":{"full_name":"OBI AMAKA GRACE","id_number":"12345678901","country":"NG","id_type":"PASSPORT"},"antifraud":{"fraud_risk":{"risk_level":"high","risk_score":100},"summary":{"fraud_detected":false,"fraud_sources":[]},"smile_secure":{"status":"clear"}}}`)
	envelope, err := services.ParseSmileIdV3Callback(body, "provider-job-risk", "provider-user-risk")
	if err != nil || !envelope.Result.ProviderRiskFlagged || envelope.Result.SpoofSuspected {
		t.Fatalf("provider risk must be retained as a distinct signal, not spoofing: %+v, %v", envelope.Result, err)
	}
	decision := services.DecideVerificationCase(services.AutoDecisionInput{
		Result: envelope.Result, Product: "document_verification", NameMatchScore: 0.99, TrustScore: 90, EligibleAtPayment: true,
	})
	if decision.Approve || !slices.Contains(decision.Reasons, "provider_risk_requires_review") || !slices.Contains(decision.FraudSignals, "provider_risk_flagged") {
		t.Fatalf("a high provider risk must go to review without being approved: %+v", decision)
	}
	lowRiskBody := strings.Replace(string(body), `"risk_level":"high"`, `"risk_level":"low"`, 1)
	lowRiskEnvelope, err := services.ParseSmileIdV3Callback([]byte(lowRiskBody), "provider-job-low-risk", "provider-user-risk")
	if err != nil || lowRiskEnvelope.Result.ProviderRiskFlagged {
		t.Fatalf("documented low risk alone must not trigger the provider-risk review flag: %+v, %v", lowRiskEnvelope.Result, err)
	}
	for _, testCase := range []struct {
		name string
		body string
	}{
		{"medium fraud risk", strings.Replace(string(body), `"risk_level":"high"`, `"risk_level":"medium"`, 1)},
		{"unknown fraud risk level", strings.Replace(string(body), `"risk_level":"high"`, `"risk_level":"critical"`, 1)},
		{"fraud summary", strings.Replace(string(body), `"fraud_detected":false`, `"fraud_detected":true`, 1)},
		{"fraud source", strings.Replace(string(body), `"fraud_sources":[]`, `"fraud_sources":["smile_secure"]`, 1)},
		{"Smile Secure attention", strings.Replace(string(body), `"smile_secure":{"status":"clear"}`, `"smile_secure":{"status":"attention"}`, 1)},
		{"unknown Smile Secure status", strings.Replace(string(body), `"smile_secure":{"status":"clear"}`, `"smile_secure":{"status":"review"}`, 1)},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			parsed, err := services.ParseSmileIdV3Callback([]byte(testCase.body), "provider-job-flagged", "provider-user-flagged")
			if err != nil || !parsed.Result.ProviderRiskFlagged || parsed.Result.SpoofSuspected {
				t.Fatalf("provider risk must remain distinct from spoofing: %+v, %v", parsed.Result, err)
			}
		})
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
