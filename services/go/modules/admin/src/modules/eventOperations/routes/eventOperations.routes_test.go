package routes

import (
	"context"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"nantty/modules/admin/src/configs"
	"nantty/modules/admin/src/container"
	"nantty/modules/admin/src/modules/eventOperations/services"
	"nantty/platform/identityports"
	"nantty/platform/identityports/identitytest"
	"nantty/platform/staffauth"
)

type fakeQueueReader struct{}

func (fakeQueueReader) ListQueues(context.Context, string) ([]services.QueueSnapshot, error) {
	return []services.QueueSnapshot{{Name: "orders", State: "running"}}, nil
}

type activeStaffSession struct{}

func (activeStaffSession) IsStaffSessionActive(context.Context, string, string) (bool, error) {
	return true, nil
}

type allowStaffNetwork struct{}

func (allowStaffNetwork) IsStaffAddressAllowed(context.Context, string, string) (bool, error) {
	return true, nil
}

func TestEventOperationsQueueRouteEnforcesPermissionAndAllowsSuperadmin(t *testing.T) {
	registry := &identityports.Registry{}
	tokens := identitytest.NewFakeTokenService(t)
	registry.RegisterStaffTokenService(tokens)
	registry.RegisterStaffSessionChecker(activeStaffSession{})
	registry.RegisterStaffNetworkPolicy(allowStaffNetwork{})

	container := &container.Container{
		Settings:       configs.AdminSettings{RabbitMQManagement: configs.RabbitMQManagementSettings{Vhost: "nantty"}},
		Logger:         slog.New(slog.DiscardHandler),
		RabbitMQQueues: fakeQueueReader{},
		Guard:          staffauth.Guard{Registry: registry},
	}
	mux := http.NewServeMux()
	MountEventOperationsRoutes(mux, container)

	withoutPermission, _, _ := tokens.SignStaffTokensForTest(t, staffauth.AdminRole, []string{"metrics:read"})
	if status := requestQueueRoute(mux, withoutPermission); status != http.StatusForbidden {
		t.Fatalf("staff without events:read got %d, want %d", status, http.StatusForbidden)
	}

	withPermission, _, _ := tokens.SignStaffTokensForTest(t, staffauth.AdminRole, []string{"events:read"})
	if status := requestQueueRoute(mux, withPermission); status != http.StatusOK {
		t.Fatalf("staff with events:read got %d, want %d", status, http.StatusOK)
	}

	superadmin, _, _ := tokens.SignStaffTokensForTest(t, staffauth.SuperadminRole, nil)
	if status := requestQueueRoute(mux, superadmin); status != http.StatusOK {
		t.Fatalf("superadmin got %d, want %d", status, http.StatusOK)
	}
}

func requestQueueRoute(handler http.Handler, token string) int {
	request := httptest.NewRequest(http.MethodGet, "/api/v1/admin/event-operations/queues", nil)
	request.RemoteAddr = "127.0.0.1:1234"
	request.Header.Set("Authorization", "Bearer "+token)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	return response.Code
}
