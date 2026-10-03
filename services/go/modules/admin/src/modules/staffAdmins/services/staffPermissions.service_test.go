package services

import "testing"

func TestNormalizePermissions(t *testing.T) {
	got, err := NormalizePermissions([]string{"admin.config.write", "admin.audit.read", "admin.config.write"})
	if err != nil || len(got) != 2 || got[0] != "admin.audit.read" {
		t.Fatalf("got %v %v", got, err)
	}
	for _, bad := range []string{"", "Admin.Read", "nodots", "a.b.c.d.e", "admin.config.write; drop"} {
		if _, err := NormalizePermissions([]string{bad}); err == nil {
			t.Errorf("%q accepted", bad)
		}
	}
}
