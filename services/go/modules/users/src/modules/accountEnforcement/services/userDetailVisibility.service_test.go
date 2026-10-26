package services

import (
	"encoding/json"
	"testing"

	"nantty/platform/staffauth"
)

func detailWithAuditAndSessions() UserDetail {
	return UserDetail{
		History:  []json.RawMessage{json.RawMessage(`{"ipAddress":"203.0.113.9","reason":"internal note"}`)},
		Sessions: []SessionView{{Id: "s1", Device: "iPhone", IpAddress: "198.51.100.4", Location: "Lagos"}},
	}
}

func TestSupportStaffSeeNeitherTheAuditTrailNorSessionIps(t *testing.T) {
	visible := detailWithAuditAndSessions().VisibleTo(staffauth.Staff{Permissions: []string{"support:tickets"}})
	if len(visible.History) != 0 {
		t.Fatalf("history shown without audit:read: %s", visible.History)
	}
	if visible.Sessions[0].IpAddress != "" || visible.Sessions[0].Location != "" || visible.Sessions[0].Device != "iPhone" {
		t.Fatalf("session PII shown without users:read-pii: %+v", visible.Sessions[0])
	}
}

func TestAuditorsAndPiiReadersSeeTheirFields(t *testing.T) {
	visible := detailWithAuditAndSessions().VisibleTo(staffauth.Staff{Permissions: []string{"users:read", "audit:read", "users:read-pii"}})
	if len(visible.History) != 1 || visible.Sessions[0].IpAddress != "198.51.100.4" {
		t.Fatalf("permitted staff lost data: %+v", visible)
	}
	if superadmin := detailWithAuditAndSessions().VisibleTo(staffauth.Staff{Role: staffauth.SuperadminRole}); len(superadmin.History) != 1 {
		t.Fatal("superadmins see everything")
	}
}
