package controllers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"nantty/platform/httpserver"
)

func TestGetPayoutOnboardingStateRejectsRefreshQuery(t *testing.T) {
	request := httptest.NewRequest("GET", "/api/v1/payments/payout-onboarding/me?refresh=true", nil)
	recorder := httptest.NewRecorder()

	(PayoutOnboardingController{}).GetState(recorder, request)

	if recorder.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusMethodNotAllowed)
	}
	var response httpserver.ApiError
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if response.Code != "METHOD_NOT_ALLOWED" {
		t.Fatalf("code = %q, want METHOD_NOT_ALLOWED", response.Code)
	}
}
