package controllers

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"nantty/platform/identityports"
	"nantty/platform/identityports/identitytest"
	"nantty/platform/staffauth"
)

func TestInternalEnforcementTrustsStepUpOnlyFromAValidTokenForTheSameStaff(t *testing.T) {
	tokens := identitytest.NewFakeTokenService(t)
	registry := &identityports.Registry{}
	registry.RegisterStaffTokenService(tokens)
	access, stepUp, staffId := tokens.SignStaffTokensForTest(t, "admin", []string{"users:suspend"})
	request := func(token string) *http.Request {
		built := httptest.NewRequest(http.MethodPost, "/", nil)
		if token != "" {
			built.Header.Set(staffauth.StepUpHeader, token)
		}
		return built
	}
	if forwardedStepUpIsValid(registry, request(""), staffId) {
		t.Fatal("a bare caller assertion without a token must not be recorded as step-up")
	}
	if forwardedStepUpIsValid(registry, request(access), staffId) {
		t.Fatal("an access token is not a step-up token")
	}
	if forwardedStepUpIsValid(registry, request(stepUp), "00000000-0000-0000-0000-000000000009") {
		t.Fatal("a step-up token for another staff member must not count")
	}
	if !forwardedStepUpIsValid(registry, request(stepUp), staffId) {
		t.Fatal("a valid step-up token for the same staff member counts")
	}
}
