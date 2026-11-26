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
	var ownerID string
	harness.queryRow("SELECT id::text FROM accounts WHERE email='application-owner@example.com'", &ownerID)
	organization := harness.expectWithHeaders("POST", "/api/v1/developer/organizations", owner, map[string]string{"name": "Application Team", "slug": "application-team"}, map[string]string{"Idempotency-Key": uuid.NewString()}, 201)
	organizationID := organization["id"].(string)
	var developerID string
	harness.queryRow("SELECT id::text FROM accounts WHERE email='application-developer@example.com'", &developerID)
	harness.execSql("INSERT INTO developer_organization_memberships (id,organization_id,account_id,role,created_at) VALUES ($1,$2,$3,'developer',now())", uuid.NewString(), organizationID, developerID)
	path := "/api/v1/developer/organizations/" + organizationID + "/applications"
	input := `{"name":"Nantty CRM","purpose":"Connect a customer support system to business messaging.","callbackOrigins":["https://crm.example.com"],"redirectUris":["https://crm.example.com/oauth/callback"],"requestedScopes":["messages:read","messages:send"]}`
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
	redirectURIs, ok := app["redirectUris"].([]any)
	if !ok || len(redirectURIs) != 1 || redirectURIs[0] != "https://crm.example.com/oauth/callback" {
		t.Fatalf("created application redirect URIs = %v", app["redirectUris"])
	}
	ownerList := harness.expect("GET", path, owner, nil, 200)
	applications, ok := ownerList["applications"].([]any)
	if !ok || len(applications) != 1 {
		t.Fatalf("owner application list = %v", ownerList)
	}
	listedApplication := applications[0].(map[string]any)
	listedRedirectURIs, ok := listedApplication["redirectUris"].([]any)
	if !ok || len(listedRedirectURIs) != 1 || listedRedirectURIs[0] != "https://crm.example.com/oauth/callback" {
		t.Fatalf("listed application redirect URIs = %v", listedApplication["redirectUris"])
	}
	status, replay := post(owner, key, input)
	if status != 200 || replay["id"] != app["id"] {
		t.Fatalf("application idempotent replay = %d %v", status, replay)
	}
	conflictingInput := `{"name":"Nantty CRM","purpose":"Connect a customer support system to business messaging.","callbackOrigins":["https://crm.example.com"],"redirectUris":["https://crm.example.com/other-callback"],"requestedScopes":["messages:read","messages:send"]}`
	status, collision := post(owner, key, conflictingInput)
	if status != 409 || collision["code"] != "IDEMPOTENCY_KEY_REUSED" {
		t.Fatalf("different request reused the same key = %d %v, want 409", status, collision)
	}
	status, updated := harness.call("PATCH", path+"/"+app["id"].(string), owner, map[string]any{
		"name": "Nantty CRM", "purpose": "Connect a customer support system to business messaging.",
		"callbackOrigins": []string{"https://crm.example.com"},
		"redirectUris":    []string{"https://crm.example.com/new-callback"},
		"requestedScopes": []string{"messages:read", "messages:send"},
	})
	updatedRedirectURIs, ok := updated["redirectUris"].([]any)
	if status != 200 || !ok || len(updatedRedirectURIs) != 1 || updatedRedirectURIs[0] != "https://crm.example.com/new-callback" {
		t.Fatalf("update application redirect URIs = %d %v", status, updated)
	}
	status, list := harness.call("GET", path, developer, nil)
	if status != 200 || len(list["applications"].([]any)) != 0 {
		t.Fatalf("ungranted developer application listing = %d %v, want an empty authorized result", status, list)
	}
	status, _ = harness.callWithHeaders("POST", path, developer, map[string]any{"name": "Denied CRM", "purpose": "Connect a support tool to business messaging.", "callbackOrigins": []string{}, "requestedScopes": []string{"messages:send"}}, map[string]string{"Idempotency-Key": uuid.NewString()})
	if status != 403 {
		t.Fatalf("non-admin application create = %d, want 403", status)
	}
	appPath := path + "/" + app["id"].(string)
	capabilitiesPath := appPath + "/capabilities/me"
	status, capabilityResult := harness.call("GET", capabilitiesPath, owner, nil)
	if status != 200 || capabilityResult["actorAccountId"] != ownerID || capabilityResult["applicationName"] != "Nantty CRM" || !containsString(capabilityResult["capabilities"], "credentials.manage") {
		t.Fatalf("owner effective application capabilities = %d %v", status, capabilityResult)
	}
	status, _ = harness.call("GET", capabilitiesPath, "", nil)
	if status != 401 {
		t.Fatalf("unauthenticated effective application capabilities = %d, want 401", status)
	}
	outsider := registerDeveloperTestAccount(t, harness, "application-capability-outsider@example.com")
	status, _ = harness.call("GET", capabilitiesPath, outsider, nil)
	if status != 404 {
		t.Fatalf("outsider effective application capabilities = %d, want 404", status)
	}
	status, _ = harness.call("GET", path+"/"+uuid.NewString()+"/capabilities/me", owner, nil)
	if status != 404 {
		t.Fatalf("unknown application capabilities = %d, want 404", status)
	}
	status, capabilityResult = harness.call("GET", capabilitiesPath, developer, nil)
	if status != 200 || containsString(capabilityResult["capabilities"], "credentials.manage") {
		t.Fatalf("ungranted developer effective capabilities = %d %v", status, capabilityResult)
	}
	var developerMembershipID string
	harness.queryRowWithArgs("SELECT id::text FROM developer_organization_memberships WHERE organization_id=$1 AND account_id=$2", []any{organizationID, developerID}, &developerMembershipID)
	grantListPath := appPath + "/members"
	status, grants := harness.call("GET", grantListPath, developer, nil)
	if status != 403 || grants["code"] != "FORBIDDEN" {
		t.Fatalf("developer grant administration = %d %v, want 403", status, grants)
	}
	status, replaced := harness.call("PUT", grantListPath+"/"+developerMembershipID+"/grants", owner, map[string]any{"capabilities": []string{"credentials.manage", "applications.read", "applications.read"}})
	if status != 200 || replaced["role"] != "developer" || len(replaced["capabilities"].([]any)) != 2 {
		t.Fatalf("replace developer application grants = %d %v", status, replaced)
	}
	status, capabilityResult = harness.call("GET", capabilitiesPath, developer, nil)
	if status != 200 || !containsString(capabilityResult["capabilities"], "credentials.manage") {
		t.Fatalf("granted developer effective capabilities = %d %v", status, capabilityResult)
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
	harness.queryRowWithArgs("SELECT count(*) FROM developer_application_member_grants WHERE organization_id=$1 AND membership_id=$2 AND capability NOT IN ('request_logs.read', 'usage.read')", []any{organizationID, developerMembershipID}, &remainingGrantRows)
	if remainingGrantRows != 0 {
		t.Fatalf("role downgrade retained ineligible grant rows = %d", remainingGrantRows)
	}
	status, capabilityResult = harness.call("GET", capabilitiesPath, developer, nil)
	if status != 200 || containsString(capabilityResult["capabilities"], "credentials.manage") {
		t.Fatalf("downgraded member retained credential capability = %d %v", status, capabilityResult)
	}
	var grantAuditCount int
	harness.queryRowWithArgs("SELECT count(*) FROM developer_organization_audit_logs WHERE organization_id=$1 AND action='application.member_grants_replaced'", []any{organizationID}, &grantAuditCount)
	if grantAuditCount != 2 {
		t.Fatalf("application grant replacement audit count = %d, want initial and analyst grant events", grantAuditCount)
	}
	var pruneAuditCount int
	harness.queryRowWithArgs("SELECT count(*) FROM developer_organization_audit_logs WHERE organization_id=$1 AND action='application.member_grants_pruned'", []any{organizationID}, &pruneAuditCount)
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
	status, _ = harness.call("GET", capabilitiesPath, owner, nil)
	if status != 404 {
		t.Fatalf("archived application capabilities = %d, want 404", status)
	}
	var auditCount int
	harness.queryRowWithArgs("SELECT count(*) FROM developer_organization_audit_logs WHERE organization_id=$1 AND action IN ('application.created','application.archived')", []any{organizationID}, &auditCount)
	if auditCount != 2 {
		t.Fatalf("application lifecycle audit entries = %d, want 2", auditCount)
	}
}

func containsString(value any, wanted string) bool {
	values, ok := value.([]any)
	if !ok {
		return false
	}
	for _, item := range values {
		if item == wanted {
			return true
		}
	}
	return false
}
