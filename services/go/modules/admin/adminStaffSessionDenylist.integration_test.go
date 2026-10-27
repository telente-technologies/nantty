package admin

import (
	"context"
	"net/http"
	"slices"
	"sync"
	"testing"
	"time"

	"nantty/modules/admin/src/generated/ent/staffsession"
	"nantty/platform/jwtauth"
)

type recordingSessionDenylist struct {
	mutex   sync.Mutex
	revoked []string
}

func (denylist *recordingSessionDenylist) IsSessionRevoked(_ context.Context, sessionId string) (bool, error) {
	denylist.mutex.Lock()
	defer denylist.mutex.Unlock()
	return slices.Contains(denylist.revoked, sessionId), nil
}

func (denylist *recordingSessionDenylist) RevokeSessions(_ context.Context, sessionIds []string, _ time.Duration) error {
	denylist.mutex.Lock()
	defer denylist.mutex.Unlock()
	denylist.revoked = append(denylist.revoked, sessionIds...)
	return nil
}

func TestRevokedStaffSessionsReachTheSharedDenylistSoOtherDeployablesRejectThem(t *testing.T) {
	harness := startAdminModuleAgainstFreshSchema(t)
	denylist := &recordingSessionDenylist{}
	previous := jwtauth.RegisteredSessionDenylist()
	jwtauth.RegisterSessionDenylist(denylist)
	t.Cleanup(func() { jwtauth.RegisterSessionDenylist(previous) })
	harness.bootstrapSuperadmin("denylisted@nantty.com")
	session, _ := harness.enrollAndSignIn("denylisted@nantty.com", strongPassword)
	harness.expect("POST", "/api/v1/admin/auth/logout", nil, bearer(session["accessToken"].(string)), http.StatusNoContent)
	revoked, err := harness.seeder.Client.StaffSession.Query().Where(staffsession.RevokedAtNotNil()).All(context.Background())
	if err != nil || len(revoked) == 0 {
		t.Fatalf("expected a revoked staff session, got %d (%v)", len(revoked), err)
	}
	for _, row := range revoked {
		if listed, _ := denylist.IsSessionRevoked(context.Background(), row.ID.String()); !listed {
			t.Fatalf("revoked staff session %s was not written to the shared denylist (got %v)", row.ID, denylist.revoked)
		}
	}
}
