package staffauth_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"zudomart/platform/identityports"
	"zudomart/platform/identityports/identitytest"
	"zudomart/platform/staffauth"
)

type allowListPolicy struct{ allowed string }

func (policy allowListPolicy) IsStaffAddressAllowed(_ context.Context, _ string, address string) (bool, error) {
	return address == policy.allowed, nil
}

type capturingRecorder struct {
	mutex  sync.Mutex
	events []identityports.AuditEvent
}

func (recorder *capturingRecorder) RecordAuditEvent(ctx context.Context, event identityports.AuditEvent) error {
	staffauth.MarkAuditRecorded(ctx)
	recorder.mutex.Lock()
	defer recorder.mutex.Unlock()
	recorder.events = append(recorder.events, event)
	return nil
}

func (recorder *capturingRecorder) actions() []string {
	recorder.mutex.Lock()
	defer recorder.mutex.Unlock()
	actions := []string{}
	for _, event := range recorder.events {
		actions = append(actions, event.Action)
	}
	return actions
}

func newGuard(t *testing.T) (staffauth.Guard, *identityports.Registry, *identitytest.FakeTokenService, *capturingRecorder) {
	registry := &identityports.Registry{}
	tokens := identitytest.NewFakeTokenService(t)
	registry.RegisterStaffTokenService(tokens)
	recorder := &capturingRecorder{}
	registry.RegisterAuditRecorder(recorder)
	return staffauth.Guard{Registry: registry}, registry, tokens, recorder
}

func serve(handler http.Handler, method, address, token string) int {
	request := httptest.NewRequest(method, "/api/v1/admin/things", nil)
	request.Header.Set("Authorization", "Bearer "+token)
	request.Header.Set("X-Real-Ip", address)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	return response.Code
}

func TestGuardRefusesStaffOutsideTheNetworkAllowList(t *testing.T) {
	guard, registry, tokens, _ := newGuard(t)
	registry.RegisterStaffNetworkPolicy(allowListPolicy{allowed: "203.0.113.7"})
	accessToken, _, _ := tokens.SignStaffTokensForTest(t, staffauth.AdminRole, []string{"users:read"})
	handler := guard.RequireStaff("users:read", false)(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) { writer.WriteHeader(http.StatusOK) }))
	if status := serve(handler, http.MethodGet, "203.0.113.7", accessToken); status != http.StatusOK {
		t.Fatalf("allowed network got %d", status)
	}
	if status := serve(handler, http.MethodGet, "198.51.100.4", accessToken); status != http.StatusForbidden {
		t.Fatalf("other network got %d", status)
	}
}

func TestGuardAuditsSuccessfulMutationsThatRecordedNothing(t *testing.T) {
	guard, _, tokens, recorder := newGuard(t)
	accessToken, _, _ := tokens.SignStaffTokensForTest(t, staffauth.AdminRole, []string{"users:read"})
	silent := guard.RequireStaff("", false)(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) { writer.WriteHeader(http.StatusNoContent) }))
	explicit := guard.RequireStaff("", false)(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		_ = recorder.RecordAuditEvent(request.Context(), identityports.AuditEvent{Action: "thing.changed"})
		writer.WriteHeader(http.StatusOK)
	}))
	failing := guard.RequireStaff("", false)(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) { writer.WriteHeader(http.StatusConflict) }))
	serve(silent, http.MethodGet, "203.0.113.7", accessToken)
	serve(silent, http.MethodPost, "203.0.113.7", accessToken)
	serve(explicit, http.MethodPut, "203.0.113.7", accessToken)
	serve(failing, http.MethodDelete, "203.0.113.7", accessToken)
	got := recorder.actions()
	if len(got) != 2 || got[0] != "admin.request" || got[1] != "thing.changed" {
		t.Fatalf("unexpected audit trail %v", got)
	}
	recorder.mutex.Lock()
	first := recorder.events[0]
	recorder.mutex.Unlock()
	if first.SubjectId != "POST /api/v1/admin/things" || first.IpAddress != "203.0.113.7" || string(first.After) != `{"status":204}` {
		t.Fatalf("catch-all entry lacks request details: %+v", first)
	}
}
