package middlewares

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"zudomart/platform/identityports/identitytest"
	"zudomart/platform/jwtauth"
	"zudomart/platform/staffauth"
)

func TestStaffGuardDeniesAnEmptyPermissionListAndMissingStepUp(t *testing.T) {
	tokens := identitytest.NewFakeTokenService(t)
	verifier := func(audience string) *jwtauth.AccessTokenVerifier {
		return jwtauth.NewAccessTokenVerifierFromKeySetProvider(tokens.PublishedKeySet, identitytest.FakeIssuer, audience)
	}
	verifiers := StaffTokenVerifiers{Access: verifier(staffauth.AccessAudience), StepUp: verifier(staffauth.StepUpAudience)}
	access, stepUp, _ := tokens.SignStaffTokensForTest(t, "admin", []string{"moderation:reports"})
	reached := http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) { writer.WriteHeader(http.StatusNoContent) })
	call := func(permissions []string, requireStepUp bool, withStepUp bool) int {
		request := httptest.NewRequest(http.MethodPost, "/", nil)
		request.Header.Set("Authorization", "Bearer "+access)
		if withStepUp {
			request.Header.Set(staffauth.StepUpHeader, stepUp)
		}
		recorder := httptest.NewRecorder()
		RequireStaffWithAnyPermission(verifiers, permissions, requireStepUp)(reached).ServeHTTP(recorder, request)
		return recorder.Code
	}
	if status := call(nil, false, true); status != http.StatusForbidden {
		t.Fatalf("an empty permission list must deny, got %d", status)
	}
	if status := call([]string{"moderation:reports"}, true, false); status != http.StatusForbidden {
		t.Fatalf("a step-up route without the step-up token must deny, got %d", status)
	}
	if status := call([]string{"moderation:reports"}, true, true); status != http.StatusNoContent {
		t.Fatalf("a valid step-up must pass, got %d", status)
	}
}
