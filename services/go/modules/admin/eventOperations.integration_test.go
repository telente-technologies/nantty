package admin

import (
	"net/http"
	"testing"
)

func TestEventOperationsQueueEndpointRequiresEventsRead(t *testing.T) {
	harness := startAdminModuleAgainstFreshSchema(t)
	root := harness.signedInSuperadmin("root.event-ops@nantty.com")
	if response := harness.call(http.MethodGet, "/api/v1/admin/event-operations/queues", nil, bearer(root.token)); response.status != http.StatusServiceUnavailable {
		t.Fatalf("unconfigured queue monitor status = %d, want 503", response.status)
	}
	staff, _ := harness.inviteAndSignIn(root, map[string]any{
		"email": "support.event-ops@nantty.com", "name": "Support", "role": "ADMIN", "permissions": []string{"support:tickets"}, "reason": "support access",
	})
	if response := harness.call(http.MethodGet, "/api/v1/admin/event-operations/queues", nil, bearer(staff.token)); response.status != http.StatusForbidden {
		t.Fatalf("staff without events:read status = %d, want 403", response.status)
	}
}
