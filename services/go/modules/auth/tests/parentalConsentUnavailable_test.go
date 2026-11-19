package auth_test

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"nantty/modules/auth/src/container"
	parentalconsent "nantty/modules/auth/src/modules/parentalConsent"
)

func TestParentalConsentCannotBeSelfAttested(t *testing.T) {
	controller := parentalconsent.Controller{Container: &container.Container{Logger: slog.New(slog.NewTextHandler(io.Discard, nil))}}
	request := httptest.NewRequest(http.MethodPost, "/api/v1/auth/parental-consent", strings.NewReader(`{"parentEmail":"parent@example.com","guardianName":"Parent","consentVersion":"1","confirmed":true}`))
	recorder := httptest.NewRecorder()
	controller.Attest(recorder, request)
	if recorder.Code != http.StatusServiceUnavailable || !strings.Contains(recorder.Body.String(), "PARENTAL_CONSENT_UNAVAILABLE") {
		t.Fatalf("expected consent issuance to fail closed, got %d %s", recorder.Code, recorder.Body.String())
	}
}
