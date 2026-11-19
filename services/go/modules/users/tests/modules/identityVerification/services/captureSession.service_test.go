package services_test

import (
	"testing"
	"time"

	"github.com/google/uuid"

	"nantty/modules/users/src/modules/identityVerification/services"
)

func TestCaptureAttemptMarkersBindProviderCallbacksToOneSession(t *testing.T) {
	caseID, attemptID := "case-1", "attempt-1"
	marker := services.CaptureAttemptMarker(caseID, attemptID)
	if !services.CaptureAttemptMatches(&marker, caseID, attemptID) {
		t.Fatal("callback for the active capture attempt must match")
	}
	if !services.CaptureAttemptRequiresSmileUserBinding(&marker, caseID) || services.CaptureAttemptRequiresSmileUserBinding(&marker, "case-other") {
		t.Fatal("new attempts must declare an exact provider user-id binding")
	}
	if !services.CaptureAttemptSmileUserMatches(&marker, caseID, "nantty-capture-attempt-1", "nantty-capture-attempt-1") || services.CaptureAttemptSmileUserMatches(&marker, caseID, "provider-user-other", "nantty-capture-attempt-1") {
		t.Fatal("new callback user IDs must match their exact capture attempt")
	}
	if services.CaptureAttemptMatches(&marker, caseID, "attempt-older") || services.CaptureAttemptMatches(&marker, "case-other", attemptID) {
		t.Fatal("a callback from a previous attempt or a different case must not match")
	}
	legacy := "capture:" + caseID
	if !services.CaptureAttemptMatches(&legacy, caseID, "") || services.CaptureAttemptMatches(&legacy, caseID, attemptID) {
		t.Fatal("legacy in-flight callbacks must remain compatible without weakening new attempt binding")
	}
	if services.CaptureAttemptRequiresSmileUserBinding(&legacy, caseID) {
		t.Fatal("legacy in-flight attempts must remain compatible without imposing a new provider user ID")
	}
	if !services.CaptureAttemptSmileUserMatches(&legacy, caseID, "provider-generated-user", "") {
		t.Fatal("legacy provider-generated user IDs remain compatible")
	}
}

func TestCaptureAttemptCallbackCanDeriveAttemptFromExactProviderUserID(t *testing.T) {
	caseID := "00000000-0000-4000-8000-000000000002"
	attemptID := "00000000-0000-4000-8000-000000000001"
	marker := services.CaptureAttemptMarker(caseID, attemptID)
	userID := "nantty-capture-" + attemptID
	if parsed, ok := services.CaptureAttemptIDFromSmileUserID(userID); !ok || parsed != attemptID {
		t.Fatalf("exact provider user ID should recover attempt ID: %q, %t", parsed, ok)
	}
	if !services.CaptureAttemptCallbackMatches(&marker, caseID, "", userID, &userID) {
		t.Fatal("nullable callback attempt metadata should match the active persisted provider user ID")
	}
	for _, test := range []struct {
		name, caseID, attemptID, userID string
		stored                          *string
	}{
		{name: "wrong attempt", caseID: caseID, attemptID: "00000000-0000-4000-8000-000000000003", userID: userID, stored: &userID},
		{name: "wrong stored user", caseID: caseID, userID: "provider-user-other", stored: &userID},
		{name: "malformed attempt", caseID: caseID, userID: "nantty-capture-not-a-uuid", stored: &userID},
		{name: "wrong case", caseID: "00000000-0000-4000-8000-000000000004", userID: userID, stored: &userID},
	} {
		t.Run(test.name, func(t *testing.T) {
			if services.CaptureAttemptCallbackMatches(&marker, test.caseID, test.attemptID, test.userID, test.stored) {
				t.Fatal("a callback not bound to the exact case and provider user ID must not match")
			}
		})
	}
	for _, userID := range []string{"", "nantty-capture-00000000-0000-0000-0000-000000000000", "nantty-capture-00000000-0000-4000-8000-000000000001/extra", "provider-generated-user"} {
		if _, ok := services.CaptureAttemptIDFromSmileUserID(userID); ok {
			t.Fatalf("invalid provider user ID %q must not recover an attempt", userID)
		}
	}
}

func TestCaptureAttemptIDForReplayRequiresExactCaseAndUserBoundAttempt(t *testing.T) {
	caseID := uuid.MustParse("0192f3a0-0000-7000-8000-000000000001")
	attemptID := uuid.MustParse("0192f3a0-0000-7000-8000-000000000002")
	marker := services.CaptureAttemptMarker(caseID.String(), attemptID.String())
	if got, ok := services.CaptureAttemptIDForReplay(&marker, caseID); !ok || got != attemptID {
		t.Fatalf("current marker replay attempt = %s, %t; want %s, true", got, ok, attemptID)
	}
	legacy := "capture:" + caseID.String() + ":" + attemptID.String() + ":userbound"
	if got, ok := services.CaptureAttemptIDForReplay(&legacy, caseID); !ok || got != attemptID {
		t.Fatalf("legacy user-bound marker replay attempt = %s, %t; want %s, true", got, ok, attemptID)
	}
	wrongCase := uuid.New()
	for _, candidate := range []struct {
		name   string
		marker string
		caseID uuid.UUID
	}{{name: "wrong case marker", marker: marker, caseID: wrongCase}, {name: "unbound legacy marker", marker: "capture:" + caseID.String(), caseID: caseID}, {name: "opaque legacy value", marker: "provider-job-123", caseID: caseID}} {
		t.Run(candidate.name, func(t *testing.T) {
			if _, ok := services.CaptureAttemptIDForReplay(&candidate.marker, candidate.caseID); ok {
				t.Fatal("callback replay must require a case-bound user-bound capture attempt")
			}
		})
	}
}

func TestCaptureAttemptMarkerFitsVerificationCaseColumn(t *testing.T) {
	caseID := "01a1f20e-8104-738f-8f49-c9f16d59197d"
	attemptID := "01a1f20e-8104-738f-8f49-c9f16d59197e"
	marker := services.CaptureAttemptMarker(caseID, attemptID)
	if len(marker) > 80 {
		t.Fatalf("capture attempt marker exceeds verification_cases.smile_job_id limit: %d chars", len(marker))
	}
	if !services.CaptureAttemptMatches(&marker, caseID, attemptID) || !services.CaptureAttemptRequiresSmileUserBinding(&marker, caseID) {
		t.Fatal("compact markers must retain case, attempt and Smile user binding")
	}
	if services.CaptureAttemptMatches(&marker, "01a1f20e-8104-738f-8f49-c9f16d591970", attemptID) {
		t.Fatal("compact markers must not match a different verification case")
	}
}

func TestCaptureSessionRetryWaitsForExpiryAndOnlyAllowsOpenCases(t *testing.T) {
	now := time.Date(2026, 11, 19, 12, 0, 0, 0, time.UTC)
	consentAt := now.Add(-services.CaptureSessionLifetime)
	marker := services.CaptureAttemptMarker("case-1", "attempt-1")
	if !services.CaptureMarkerCanRetry("awaiting_capture", &marker, &consentAt, now) {
		t.Fatal("an expired capture attempt should be safely replaceable")
	}
	consentAt = now.Add(-services.CaptureSessionLifetime + time.Second)
	if services.CaptureMarkerCanRetry("awaiting_capture", &marker, &consentAt, now) {
		t.Fatal("a live capture attempt must not be duplicated")
	}
	if services.CaptureMarkerCanRetry("processing", &marker, &consentAt, now.Add(time.Hour)) {
		t.Fatal("a case with a provider result in progress must not be restarted")
	}
	legacyProviderJob := "smile-job-1"
	if services.CaptureMarkerCanRetry("awaiting_capture", &legacyProviderJob, &consentAt, now.Add(time.Hour)) {
		t.Fatal("an opaque provider job reference must not be treated as a legacy capture-attempt marker")
	}
	legacyCaptureMarker := "018d2b9a-6c50-7a3b-9f61-a51b2e7eaa31"
	if !services.CaptureMarkerCanRetry("awaiting_capture", &legacyCaptureMarker, &consentAt, now.Add(time.Hour)) {
		t.Fatal("an expired pre-attempt-id capture marker must be recoverable")
	}
}

func TestWebCaptureCancellationRequiresTheExactLiveDocumentAttempt(t *testing.T) {
	marker := services.CaptureAttemptMarker("case-1", "attempt-1")
	if !services.WebPhotoDocumentCaptureCanCancel("awaiting_capture", "document_verification", &marker, "case-1", "attempt-1") {
		t.Fatal("the active document capture may be released after the Web SDK confirms user cancellation")
	}
	if !services.WebPhotoDocumentCaptureCanCancel("awaiting_capture", "enhanced_document_verification", &marker, "case-1", "attempt-1") {
		t.Fatal("the active enhanced photo-document capture may also be released after cancellation")
	}
	for _, test := range []struct {
		name, status, product, caseID, attemptID string
		marker                                   *string
	}{
		{name: "wrong attempt", status: "awaiting_capture", product: "document_verification", caseID: "case-1", attemptID: "attempt-2", marker: &marker},
		{name: "wrong case", status: "awaiting_capture", product: "document_verification", caseID: "case-2", attemptID: "attempt-1", marker: &marker},
		{name: "number lookup", status: "awaiting_capture", product: "enhanced_kyc", caseID: "case-1", attemptID: "attempt-1", marker: &marker},
		{name: "result already processing", status: "processing", product: "document_verification", caseID: "case-1", attemptID: "attempt-1", marker: &marker},
		{name: "missing marker", status: "awaiting_capture", product: "document_verification", caseID: "case-1", attemptID: "attempt-1"},
	} {
		t.Run(test.name, func(t *testing.T) {
			if services.WebPhotoDocumentCaptureCanCancel(test.status, test.product, test.marker, test.caseID, test.attemptID) {
				t.Fatal("cancellation must not release stale, mismatched, or non-document attempts")
			}
		})
	}
}
