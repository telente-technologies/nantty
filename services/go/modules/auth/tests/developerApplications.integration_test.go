package auth_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/google/uuid"
)

func TestDeveloperApplicationsAreOrganizationScopedAndAudited(t *testing.T) {
	harness := startAuthModuleAgainstFreshSchema(t)
	owner := registerDeveloperTestAccount(t, harness, "application-owner@example.com")
	developer := registerDeveloperTestAccount(t, harness, "application-developer@example.com")
	organization := harness.expect("POST", "/api/v1/developer/organizations", owner, map[string]string{"name": "Application Team", "slug": "application-team"}, 201)
	organizationID := organization["id"].(string)
	var developerID string
	harness.queryRow("SELECT id::text FROM accounts WHERE email='application-developer@example.com'", &developerID)
	harness.execSql("INSERT INTO developer_organization_memberships (id,organization_id,account_id,role,created_at) VALUES ($1,$2,$3,'developer',now())", uuid.NewString(), organizationID, developerID)
	path := "/api/v1/developer/organizations/" + organizationID + "/applications"
	input := `{"name":"Nantty CRM","purpose":"Connect a customer support system to business messaging.","callbackOrigins":["https://crm.example.com"],"requestedScopes":["messages:read","messages:send"]}`
	post := func(token, key, body string) (int, map[string]any) {
		request, err := http.NewRequest("POST", harness.server.URL+path, bytes.NewBufferString(body))
		if err != nil {
			t.Fatal(err)
		}
		request.Header.Set("Authorization", "Bearer "+token)
		request.Header.Set("Content-Type", "application/json")
		request.Header.Set("Idempotency-Key", key)
		response, err := http.DefaultClient.Do(request)
		if err != nil {
			t.Fatal(err)
		}
		defer response.Body.Close()
		responseBody := map[string]any{}
		if err := json.NewDecoder(response.Body).Decode(&responseBody); err != nil {
			t.Fatal(err)
		}
		return response.StatusCode, responseBody
	}
	key := uuid.NewString()
	status, app := post(owner, key, input)
	if status != 201 || app["status"] != "draft" || app["apiProduct"] != "business_messaging" {
		t.Fatalf("application create = %d %v", status, app)
	}
	ownerList := harness.expect("GET", path, owner, nil, 200)
	applications, ok := ownerList["applications"].([]any)
	if !ok || len(applications) != 1 {
		t.Fatalf("owner application list = %v", ownerList)
	}
	status, replay := post(owner, key, input)
	if status != 200 || replay["id"] != app["id"] {
		t.Fatalf("application idempotent replay = %d %v", status, replay)
	}
	conflictingInput := `{"name":"Another CRM","purpose":"Connect a customer support system to business messaging.","callbackOrigins":["https://crm.example.com"],"requestedScopes":["messages:read","messages:send"]}`
	status, collision := post(owner, key, conflictingInput)
	if status != 409 || collision["code"] != "IDEMPOTENCY_KEY_REUSED" {
		t.Fatalf("different request reused the same key = %d %v, want 409", status, collision)
	}
	status, list := harness.call("GET", path, developer, nil)
	if status != 200 || len(list["applications"].([]any)) != 0 {
		t.Fatalf("ungranted developer application listing = %d %v, want an empty authorized result", status, list)
	}
	status, _ = harness.call("POST", path, developer, map[string]any{"name": "Denied CRM", "purpose": "Connect a support tool to business messaging.", "callbackOrigins": []string{}, "requestedScopes": []string{"messages:send"}})
	if status != 403 {
		t.Fatalf("non-admin application create = %d, want 403", status)
	}
	appPath := path + "/" + app["id"].(string)
	var developerMembershipID string
	harness.queryRow("SELECT id::text FROM developer_organization_memberships WHERE organization_id=$1 AND account_id=$2", &developerMembershipID, organizationID, developerID)
	grantListPath := appPath + "/members"
	status, grants := harness.call("GET", grantListPath, developer, nil)
	if status != 403 || grants["code"] != "FORBIDDEN" {
		t.Fatalf("developer grant administration = %d %v, want 403", status, grants)
	}
	status, replaced := harness.call("PUT", grantListPath+"/"+developerMembershipID+"/grants", owner, map[string]any{"capabilities": []string{"credentials.manage", "applications.read", "applications.read"}})
	if status != 200 || replaced["role"] != "developer" || len(replaced["capabilities"].([]any)) != 2 {
		t.Fatalf("replace developer application grants = %d %v", status, replaced)
	}
	status, list = harness.call("GET", path, developer, nil)
	applications, ok = list["applications"].([]any)
	if status != 200 || !ok || len(applications) != 1 || applications[0].(map[string]any)["id"] != app["id"] {
		t.Fatalf("application.read grant did not expose only the granted application = %d %v", status, list)
	}
	status, detail := harness.call("GET", appPath, developer, nil)
	if status != 200 || detail["id"] != app["id"] {
		t.Fatalf("granted application detail = %d %v", status, detail)
	}
	status, grantList := harness.call("GET", grantListPath, owner, nil)
	grantMembers, ok := grantList["members"].([]any)
	if status != 200 || !ok || len(grantMembers) != 2 {
		t.Fatalf("owner application member grants = %d %v", status, grantList)
	}
	status, _ = harness.call("PUT", grantListPath+"/"+developerMembershipID+"/grants", developer, map[string]any{"capabilities": []string{}})
	if status != 403 {
		t.Fatalf("non-manager grant update = %d, want 403", status)
	}
	status, _ = harness.call("PUT", grantListPath+"/"+developerMembershipID+"/grants", owner, map[string]any{"capabilities": []string{"messages:send"}})
	if status != 400 {
		t.Fatalf("requested API scope used as application capability = %d, want 400", status)
	}
	status, downgraded := harness.call("PATCH", "/api/v1/developer/organizations/"+organizationID+"/members/"+developerMembershipID, owner, map[string]string{"role": "analyst"})
	if status != 200 || downgraded["role"] != "analyst" {
		t.Fatalf("member role downgrade = %d %v", status, downgraded)
	}
	status, list = harness.call("GET", path, developer, nil)
	if status != 200 || len(list["applications"].([]any)) != 0 {
		t.Fatalf("ineligible application.read grant remains effective after role downgrade = %d %v", status, list)
	}
	status, _ = harness.call("PUT", grantListPath+"/"+developerMembershipID+"/grants", owner, map[string]any{"capabilities": []string{"credentials.manage"}})
	if status != 400 {
		t.Fatalf("role-ineligible capability grant = %d, want 400", status)
	}
	status, analystGrant := harness.call("PUT", grantListPath+"/"+developerMembershipID+"/grants", owner, map[string]any{"capabilities": []string{"usage.read"}})
	if status != 200 || len(analystGrant["eligibleCapabilities"].([]any)) != 2 {
		t.Fatalf("analyst-eligible capability grant = %d %v", status, analystGrant)
	}
	status, _ = harness.call("GET", appPath, developer, nil)
	if status != 403 {
		t.Fatalf("analyst without applications.read accessed app metadata = %d, want 403", status)
	}
	var remainingGrantRows int
	harness.queryRow("SELECT count(*) FROM developer_application_member_grants WHERE organization_id=$1 AND membership_id=$2", &remainingGrantRows, organizationID, developerMembershipID)
	if remainingGrantRows != 0 {
		t.Fatalf("role downgrade retained ineligible grant rows = %d", remainingGrantRows)
	}
	var grantAuditCount int
	harness.queryRow("SELECT count(*) FROM developer_organization_audit_logs WHERE organization_id=$1 AND action='application.member_grants_replaced'", &grantAuditCount, organizationID)
	if grantAuditCount != 2 {
		t.Fatalf("application grant replacement audit count = %d, want initial and analyst grant events", grantAuditCount)
	}
	var pruneAuditCount int
	harness.queryRow("SELECT count(*) FROM developer_organization_audit_logs WHERE organization_id=$1 AND action='application.member_grants_pruned'", &pruneAuditCount, organizationID)
	if pruneAuditCount != 1 {
		t.Fatalf("application grant pruning audit count = %d, want one role-change event", pruneAuditCount)
	}
	status, _ = harness.call("GET", appPath, registerDeveloperTestAccount(t, harness, "application-outsider@example.com"), nil)
	if status != 404 {
		t.Fatalf("outsider application read = %d, want 404", status)
	}
	if status, _ = harness.call("DELETE", appPath, owner, nil); status != 204 {
		t.Fatalf("archive application = %d, want 204", status)
	}
	status, _ = harness.call("GET", appPath, owner, nil)
	if status != 404 {
		t.Fatalf("archived application read = %d, want 404", status)
	}
	var auditCount int
	harness.queryRow("SELECT count(*) FROM developer_organization_audit_logs WHERE organization_id=$1 AND action IN ('application.created','application.archived')", &auditCount, organizationID)
	if auditCount != 2 {
		t.Fatalf("application lifecycle audit entries = %d, want 2", auditCount)
	}
}
