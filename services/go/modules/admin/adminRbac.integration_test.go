package admin

import (
	"net/http"
	"strings"
	"testing"
)

type signedInStaff struct {
	token    string
	stepUp   map[string]string
	id       string
	secret   string
	nextStep int64
	cached   map[string]string
}

func (staff *signedInStaff) withStepUp(harness *adminHarness) map[string]string {
	if staff.cached == nil {
		staff.cached = bearerWithStepUp(staff.token, harness.grantStepUp(staff.token, staff.secret, 1))
	}
	return staff.cached
}

func (harness *adminHarness) signedInSuperadmin(email string) *signedInStaff {
	harness.bootstrapSuperadmin(email)
	session, secret := harness.enrollAndSignIn(email, strongPassword)
	token := harness.signInWithMfa(email, strongPassword, secret, 0)["accessToken"].(string)
	return &signedInStaff{token: token, id: session["staff"].(map[string]any)["id"].(string), secret: secret, nextStep: 0}
}

func (harness *adminHarness) inviteAndSignIn(inviter *signedInStaff, body map[string]any) (*signedInStaff, map[string]any) {
	harness.t.Helper()
	created := harness.expect("POST", "/api/v1/admin/admins", body, inviter.withStepUp(harness), http.StatusCreated)
	email := body["email"].(string)
	harness.expect("POST", "/api/v1/admin/auth/accept-invitation", map[string]string{"token": harness.lastLoggedInvitationToken(), "password": adminPassword}, nil, http.StatusNoContent)
	session, secret := harness.enrollAndSignIn(email, adminPassword)
	return &signedInStaff{token: session["accessToken"].(string), id: session["staff"].(map[string]any)["id"].(string), secret: secret, nextStep: 0}, created
}

func TestDepartmentTemplatesCustomRolesAndUnionOfPermissions(t *testing.T) {
	harness := startAdminModuleAgainstFreshSchema(t)
	root := harness.signedInSuperadmin("root.rbac@zudomart.com")

	roles := harness.expect("GET", "/api/v1/admin/roles", nil, bearer(root.token), http.StatusOK)["items"].([]any)
	templates := map[string]string{}
	for _, entry := range roles {
		role := entry.(map[string]any)
		if role["isTemplate"] == true {
			templates[role["department"].(string)] = role["id"].(string)
		}
	}
	for _, department := range []string{"Support", "Marketing", "Sales", "Finance", "Trust & Safety", "Verification", "Content", "Ads", "Legal", "Engineering"} {
		if templates[department] == "" {
			t.Fatalf("missing department template %s in %v", department, roles)
		}
	}
	custom := harness.expect("POST", "/api/v1/admin/roles", map[string]any{"name": "Refund desk", "permissions": []string{"refunds:issue", "orders:read"}, "reason": "finance split"}, root.withStepUp(harness), http.StatusCreated)
	harness.expect("POST", "/api/v1/admin/roles", map[string]any{"name": "refund desk", "permissions": []string{"orders:read"}, "reason": "duplicate name"}, root.withStepUp(harness), http.StatusConflict)

	staff, created := harness.inviteAndSignIn(root, map[string]any{
		"email": "multi@zudomart.com", "name": "Multi Role", "role": "ADMIN", "roleIds": []string{templates["Support"], custom["id"].(string)}, "permissions": []string{"audit:read"}, "reason": "joins support and refunds",
	})
	view := created["admin"].(map[string]any)
	permissions := map[string]bool{}
	for _, permission := range view["permissions"].([]any) {
		permissions[permission.(string)] = true
	}
	for _, expected := range []string{"support:tickets", "refunds:issue", "orders:read", "audit:read"} {
		if !permissions[expected] {
			t.Fatalf("effective permissions are the union of every role and direct grants, missing %s: %v", expected, permissions)
		}
	}
	if len(view["roleNames"].([]any)) != 2 {
		t.Fatalf("several roles per admin: %v", view)
	}
	harness.expect("GET", "/api/v1/admin/audit", nil, bearer(staff.token), http.StatusOK)
	harness.expect("GET", "/api/v1/admin/config", nil, bearer(staff.token), http.StatusForbidden)
	harness.expect("GET", "/api/v1/admin/admins", nil, bearer(staff.token), http.StatusForbidden)

	if audit := harness.expect("GET", "/api/v1/admin/audit?action=admin.created", nil, bearer(staff.token), http.StatusOK)["data"].([]any); len(audit) != 1 {
		t.Fatalf("unexpected audit %v", audit)
	} else if entry := audit[0].(map[string]any); entry["actor"].(map[string]any)["name"] != "Root" || entry["reason"] != "joins support and refunds" || entry["target"].(map[string]any)["label"] != "multi@zudomart.com" || entry["stepUpVerified"] != true {
		t.Fatalf("every audit entry carries the staff name, target, reason and step-up flag: %v", entry)
	}
}

func TestAdminsCannotGrantWhatTheyLackOrTouchSuperadmins(t *testing.T) {
	harness := startAdminModuleAgainstFreshSchema(t)
	root := harness.signedInSuperadmin("root.guard@zudomart.com")
	manager, _ := harness.inviteAndSignIn(root, map[string]any{"email": "manager@zudomart.com", "name": "Manager", "role": "ADMIN", "permissions": []string{"staff:manage", "audit:read"}, "reason": "staff manager"})

	unheld := harness.expect("POST", "/api/v1/admin/admins", map[string]any{"email": "greedy@zudomart.com", "name": "Greedy", "role": "ADMIN", "permissions": []string{"ledger:read"}, "reason": "needs ledger"}, manager.withStepUp(harness), http.StatusForbidden)
	if unheld["code"] != "CANNOT_GRANT_UNHELD_PERMISSION" {
		t.Fatalf("unexpected %v", unheld)
	}
	harness.expect("POST", "/api/v1/admin/admins", map[string]any{"email": "ok.grant@zudomart.com", "name": "Fine", "role": "SUPPORT", "permissions": []string{"audit:read"}, "reason": "audit access only"}, manager.withStepUp(harness), http.StatusCreated)
	noSuper := harness.expect("POST", "/api/v1/admin/admins", map[string]any{"email": "boss@zudomart.com", "name": "Boss", "role": "SUPERADMIN", "reason": "wants to be boss"}, manager.withStepUp(harness), http.StatusForbidden)
	if noSuper["code"] != "ADMINS_CANNOT_CREATE_SUPERADMINS" {
		t.Fatalf("unexpected %v", noSuper)
	}
	noEdit := harness.expect("PUT", "/api/v1/admin/admins/"+root.id+"/permissions", map[string]any{"role": "ADMIN", "permissions": []string{"audit:read"}, "reason": "demote the boss"}, manager.withStepUp(harness), http.StatusForbidden)
	if noEdit["code"] != "ADMINS_CANNOT_EDIT_SUPERADMINS" {
		t.Fatalf("unexpected %v", noEdit)
	}
	harness.expect("POST", "/api/v1/admin/admins/"+root.id+"/suspend", map[string]string{"reason": "cut off the boss"}, manager.withStepUp(harness), http.StatusForbidden)
	harness.expect("POST", "/api/v1/admin/admins", map[string]any{"email": "bad@zudomart.com", "name": "Bad", "role": "ADMIN", "permissions": []string{"not:a-permission"}, "reason": "unknown key"}, manager.withStepUp(harness), http.StatusBadRequest)
}

func TestSecondSuperadminApprovalSettingAndSessionKilling(t *testing.T) {
	harness := startAdminModuleAgainstFreshSchema(t)
	root := harness.signedInSuperadmin("root.second@zudomart.com")
	if settings := harness.expect("GET", "/api/v1/admin/staff-settings", nil, bearer(root.token), http.StatusOK); settings["requireSecondSuperadminApproval"] != true {
		t.Fatalf("the second superadmin approval defaults to on: %v", settings)
	}
	pending := harness.expect("POST", "/api/v1/admin/admins", map[string]any{"email": "second.super@zudomart.com", "name": "Second", "role": "SUPERADMIN", "reason": "second superadmin"}, root.withStepUp(harness), http.StatusCreated)
	if pending["admin"].(map[string]any)["status"] != "PENDING_APPROVAL" || pending["invitationSentTo"] != nil {
		t.Fatalf("a new superadmin waits for approval: %v", pending)
	}
	pendingId := pending["admin"].(map[string]any)["id"].(string)
	harness.expect("POST", "/api/v1/admin/auth/login", map[string]string{"email": "second.super@zudomart.com", "password": adminPassword}, nil, http.StatusUnauthorized)
	same := harness.expect("POST", "/api/v1/admin/admins/"+pendingId+"/approve", map[string]string{"reason": "approving my own request"}, root.withStepUp(harness), http.StatusConflict)
	if same["code"] != "SAME_SUPERADMIN" {
		t.Fatalf("unexpected %v", same)
	}

	harness.bootstrapSuperadmin("other.root@zudomart.com")
	otherSession, otherSecret := harness.enrollAndSignIn("other.root@zudomart.com", strongPassword)
	other := &signedInStaff{token: harness.signInWithMfa("other.root@zudomart.com", strongPassword, otherSecret, 0)["accessToken"].(string), secret: otherSecret, id: otherSession["staff"].(map[string]any)["id"].(string)}
	approved := harness.expect("POST", "/api/v1/admin/admins/"+pendingId+"/approve", map[string]string{"reason": "verified in person"}, other.withStepUp(harness), http.StatusOK)
	if approved["admin"].(map[string]any)["status"] != "INVITED" || approved["admin"].(map[string]any)["approvedByName"] == nil {
		t.Fatalf("unexpected %v", approved)
	}
	harness.expect("POST", "/api/v1/admin/admins/"+pendingId+"/approve", map[string]string{"reason": "approving a second time"}, other.withStepUp(harness), http.StatusConflict)
	harness.expect("PUT", "/api/v1/admin/staff-settings", map[string]any{"requireSecondSuperadminApproval": false, "reason": "small team"}, bearer(root.token), http.StatusForbidden)
	harness.expect("PUT", "/api/v1/admin/staff-settings", map[string]any{"requireSecondSuperadminApproval": false, "reason": "small team"}, root.withStepUp(harness), http.StatusOK)
	direct := harness.expect("POST", "/api/v1/admin/admins", map[string]any{"email": "direct.super@zudomart.com", "name": "Direct", "role": "SUPERADMIN", "reason": "no approval needed now"}, root.withStepUp(harness), http.StatusCreated)
	if direct["admin"].(map[string]any)["status"] != "INVITED" {
		t.Fatalf("with the setting off a superadmin is invited at once: %v", direct)
	}

	victim, _ := harness.inviteAndSignIn(root, map[string]any{"email": "victim@zudomart.com", "name": "Victim", "role": "SUPPORT", "permissions": []string{"audit:read"}, "reason": "support agent"})
	harness.expect("GET", "/api/v1/admin/audit", nil, bearer(victim.token), http.StatusOK)
	suspended := harness.expect("POST", "/api/v1/admin/admins/"+victim.id+"/suspend", map[string]string{"reason": "investigating misuse"}, root.withStepUp(harness), http.StatusOK)
	if suspended["admin"].(map[string]any)["status"] != "SUSPENDED" {
		t.Fatalf("unexpected %v", suspended)
	}
	harness.expect("GET", "/api/v1/admin/audit", nil, bearer(victim.token), http.StatusUnauthorized)
	harness.expect("POST", "/api/v1/admin/admins/"+victim.id+"/enable", map[string]string{"reason": "cleared of misuse"}, root.withStepUp(harness), http.StatusOK)
	harness.expect("POST", "/api/v1/admin/admins/"+victim.id+"/revoke", map[string]string{"reason": "confirmed misuse"}, root.withStepUp(harness), http.StatusOK)
	gone := harness.expect("POST", "/api/v1/admin/admins/"+victim.id+"/enable", map[string]string{"reason": "second chance please"}, root.withStepUp(harness), http.StatusConflict)
	if gone["code"] != "ACCESS_REVOKED" {
		t.Fatalf("revoked access is permanent: %v", gone)
	}
	harness.expect("POST", "/api/v1/admin/admins/"+root.id+"/suspend", map[string]string{"reason": "locking myself out"}, root.withStepUp(harness), http.StatusConflict)
	detail := harness.expect("GET", "/api/v1/admin/admins/"+victim.id, nil, bearer(root.token), http.StatusOK)
	if len(detail["lastActions"].([]any)) == 0 && len(detail["history"].([]any)) < 3 {
		t.Fatalf("the detail carries the history and last actions: %v", detail)
	}
}

func TestAuditCsvExportNeutralisesFormulasAndIsItselfAudited(t *testing.T) {
	harness := startAdminModuleAgainstFreshSchema(t)
	root := harness.signedInSuperadmin("root.csv@zudomart.com")
	harness.expect("POST", "/api/v1/admin/roles", map[string]any{"name": "Formula role", "permissions": []string{"orders:read"}, "reason": "=HYPERLINK(\"http://evil\")"}, root.withStepUp(harness), http.StatusCreated)
	export := harness.call("GET", "/api/v1/admin/audit/export?format=csv&action=role.created", nil, bearer(root.token))
	if export.status != http.StatusOK || !strings.Contains(string(export.raw), "'=HYPERLINK") || strings.Contains(string(export.raw), ",=HYPERLINK") {
		t.Fatalf("cells starting with = + - @ must be prefixed: %d %s", export.status, export.raw)
	}
	facets := harness.expect("GET", "/api/v1/admin/audit/facets", nil, bearer(root.token), http.StatusOK)
	if len(facets["areas"].([]any)) == 0 || len(facets["actors"].([]any)) == 0 {
		t.Fatalf("unexpected facets %v", facets)
	}
	entry := harness.expect("GET", "/api/v1/admin/audit?action=audit.exported", nil, bearer(root.token), http.StatusOK)["data"].([]any)
	if len(entry) != 1 {
		t.Fatalf("the export itself is audited: %v", entry)
	}
	one := harness.expect("GET", "/api/v1/admin/audit/"+entry[0].(map[string]any)["id"].(string), nil, bearer(root.token), http.StatusOK)
	if one["action"] != "audit.exported" {
		t.Fatalf("unexpected %v", one)
	}
}
