package middlewares

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
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

type refusingNetworkPolicy struct{ allowedAddress string }

func (policy refusingNetworkPolicy) IsStaffAddressAllowed(_ context.Context, _, address string) (bool, error) {
	return address == policy.allowedAddress, nil
}

func TestTrustStaffRoutesEnforceTheStaffIpAllowList(t *testing.T) {
	restore := staffauth.UseNetworkGate(staffauth.NetworkGate{Policy: refusingNetworkPolicy{allowedAddress: "203.0.113.40"}, FailClosed: true})
	defer restore()
	tokens := identitytest.NewFakeTokenService(t)
	verifier := func(audience string) *jwtauth.AccessTokenVerifier {
		return jwtauth.NewAccessTokenVerifierFromKeySetProvider(tokens.PublishedKeySet, identitytest.FakeIssuer, audience)
	}
	verifiers := StaffTokenVerifiers{Access: verifier(staffauth.AccessAudience), StepUp: verifier(staffauth.StepUpAudience)}
	access, _, _ := tokens.SignStaffTokensForTest(t, "admin", []string{"moderation:reports"})
	reached := http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) { writer.WriteHeader(http.StatusNoContent) })
	call := func(address string) *httptest.ResponseRecorder {
		request := httptest.NewRequest(http.MethodPost, "/api/v1/admin/moderation/reports/r1/decision", nil)
		request.Header.Set("Authorization", "Bearer "+access)
		request.RemoteAddr = address + ":4431"
		recorder := httptest.NewRecorder()
		RequireStaffWithAnyPermission(verifiers, []string{"moderation:reports"}, false)(reached).ServeHTTP(recorder, request)
		return recorder
	}
	if refused := call("198.51.100.9"); refused.Code != http.StatusForbidden || !strings.Contains(refused.Body.String(), "IP_NOT_ALLOWED") {
		t.Fatalf("an office-only admin must be refused from another network: %d %s", refused.Code, refused.Body.String())
	}
	if allowed := call("203.0.113.40"); allowed.Code != http.StatusNoContent {
		t.Fatalf("the allowed network must pass: %d %s", allowed.Code, allowed.Body.String())
	}
}
