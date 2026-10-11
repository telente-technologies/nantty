package staffauth_test

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"zudomart/platform/identityports"
	"zudomart/platform/staffauth"
)

func serveWithStepUp(handler http.Handler, accessToken, stepUpToken, body string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(http.MethodPost, "/api/v1/admin/users/u1/ban", strings.NewReader(body))
	request.RemoteAddr = "203.0.113.7:1234"
	request.Header.Set("Authorization", "Bearer "+accessToken)
	request.Header.Set("Content-Type", "application/json")
	if stepUpToken != "" {
		request.Header.Set(staffauth.StepUpHeader, stepUpToken)
	}
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	return response
}

func readErrorCode(t *testing.T, response *httptest.ResponseRecorder) string {
	t.Helper()
	var payload struct {
		Code string `json:"code"`
	}
	_ = json.Unmarshal(response.Body.Bytes(), &payload)
	return payload.Code
}

func TestStepUpIsRequiredAndBoundToTheSameSession(t *testing.T) {
	guard, registry, tokens, _ := newGuard(t)
	registry.RegisterStaffNetworkPolicy(allowListPolicy{allowed: "203.0.113.7"})
	ok := http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) { writer.WriteHeader(http.StatusOK) })
	handler := guard.RequireStaff("users:ban", true)(ok)
	accessToken, stepUpToken, _ := tokens.SignStaffTokensForTest(t, staffauth.AdminRole, []string{"users:ban"})
	_, otherSessionStepUp, _ := tokens.SignStaffTokensForTest(t, staffauth.AdminRole, []string{"users:ban"})

	if response := serveWithStepUp(handler, accessToken, "", `{"reason":"spam ring"}`); response.Code != http.StatusForbidden || readErrorCode(t, response) != "STEP_UP_REQUIRED" {
		t.Fatalf("missing step-up got %d %s", response.Code, response.Body.String())
	}
	if response := serveWithStepUp(handler, accessToken, otherSessionStepUp, `{"reason":"spam ring"}`); response.Code != http.StatusForbidden || readErrorCode(t, response) != "STEP_UP_REQUIRED" {
		t.Fatalf("step-up replayed from another session got %d", response.Code)
	}
	if response := serveWithStepUp(handler, accessToken, accessToken, `{"reason":"spam ring"}`); response.Code != http.StatusForbidden {
		t.Fatalf("an access token must not pass as a step-up token, got %d", response.Code)
	}
	if response := serveWithStepUp(handler, accessToken, stepUpToken, `{"reason":"spam ring"}`); response.Code != http.StatusOK {
		t.Fatalf("valid step-up got %d", response.Code)
	}
}

func TestExpiredStepUpTokenIsRefused(t *testing.T) {
	guard, registry, tokens, _ := newGuard(t)
	registry.RegisterStaffNetworkPolicy(allowListPolicy{allowed: "203.0.113.7"})
	handler := guard.RequireStaff("users:ban", true)(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) { writer.WriteHeader(http.StatusOK) }))
	claims := identityports.StaffTokenClaims{StaffId: uuid.NewString(), SessionId: uuid.NewString(), Roles: staffauth.RolesClaimForStaff(staffauth.AdminRole, []string{"users:ban"})}
	accessToken, _, err := tokens.SignStaffAccessToken(claims)
	if err != nil {
		t.Fatal(err)
	}
	expired, err := tokens.SignStaffStepUpToken(claims, -time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	fresh, err := tokens.SignStaffStepUpToken(claims, time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	if response := serveWithStepUp(handler, accessToken, fresh, `{"reason":"spam ring"}`); response.Code != http.StatusOK {
		t.Fatalf("fresh step-up for the same session got %d", response.Code)
	}
	if response := serveWithStepUp(handler, accessToken, expired, `{"reason":"spam ring"}`); response.Code != http.StatusForbidden {
		t.Fatalf("expired step-up got %d", response.Code)
	}
}

func TestCatchAllAuditKeepsTheReasonAndTheHandlerStillReadsTheBody(t *testing.T) {
	guard, registry, tokens, recorder := newGuard(t)
	registry.RegisterStaffNetworkPolicy(allowListPolicy{allowed: "203.0.113.7"})
	accessToken, stepUpToken, _ := tokens.SignStaffTokensForTest(t, staffauth.AdminRole, []string{"users:ban"})
	var seenBody string
	handler := guard.RequireStaff("users:ban", true)(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		raw, _ := io.ReadAll(request.Body)
		seenBody = string(raw)
		writer.WriteHeader(http.StatusOK)
	}))
	body := `{"reason":"  Repeated scam listings  ","durationDays":null}`
	if response := serveWithStepUp(handler, accessToken, stepUpToken, body); response.Code != http.StatusOK {
		t.Fatalf("got %d", response.Code)
	}
	if seenBody != body {
		t.Fatalf("handler saw %q", seenBody)
	}
	recorder.mutex.Lock()
	defer recorder.mutex.Unlock()
	if len(recorder.events) != 1 || recorder.events[0].Reason != "Repeated scam listings" || !recorder.events[0].StepUpVerified {
		t.Fatalf("audit entry %+v", recorder.events)
	}
}
