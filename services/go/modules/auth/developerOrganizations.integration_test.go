package auth

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"
)

func TestDeveloperOrganizationCreationIsIdempotentAndMembershipScoped(t *testing.T) {
	harness := startAuthModuleAgainstFreshSchema(t)
	owner := registerDeveloperTestAccount(t, harness, "developer-owner@example.com")
	other := registerDeveloperTestAccount(t, harness, "developer-other@example.com")
	request := map[string]string{"name": "Nantty Integrations", "slug": "nantty-integrations"}
	status, created := harness.call("POST", "/api/v1/developer/organizations", owner, request)
	if status != 400 {
		t.Fatalf("create without an idempotency key = %d, want 400", status)
	}

	create := func(key string) (int, map[string]any) {
		request, _ := http.NewRequest("POST", harness.server.URL+"/api/v1/developer/organizations", strings.NewReader(`{"name":"Nantty Integrations","slug":"nantty-integrations"}`))
		request.Header.Set("Authorization", "Bearer "+owner)
		request.Header.Set("Content-Type", "application/json")
		request.Header.Set("Idempotency-Key", key)
		response, err := http.DefaultClient.Do(request)
		if err != nil {
			t.Fatal(err)
		}
		defer response.Body.Close()
		body := map[string]any{}
		if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		return response.StatusCode, body
	}

	key := uuid.NewString()
	status, created = create(key)
	if status != 201 || created["role"] != "owner" || created["slug"] != "nantty-integrations" {
		t.Fatalf("organization creation = %d %v", status, created)
	}
	status, replayed := create(key)
	if status != 200 || replayed["id"] != created["id"] {
		t.Fatalf("idempotent replay = %d %v, original %v", status, replayed, created)
	}
	status, listed := harness.call("GET", "/api/v1/developer/organizations", owner, nil)
	organizations, ok := listed["organizations"].([]any)
	if status != 200 || !ok || len(organizations) != 1 {
		t.Fatalf("owner list = %d %v", status, listed)
	}
	organizationID := created["id"].(string)
	var otherAccountID string
	harness.queryRow("SELECT id::text FROM accounts WHERE email = 'developer-other@example.com'", &otherAccountID)
	harness.execSql("INSERT INTO developer_organization_memberships (id, organization_id, account_id, role, created_at) VALUES ($1, $2, $3, 'developer', now())", uuid.NewString(), organizationID, otherAccountID)
	status, organization := harness.call("GET", "/api/v1/developer/organizations/"+organizationID, owner, nil)
	if status != 200 || organization["id"] != organizationID || organization["role"] != "owner" {
		t.Fatalf("owner organization detail = %d %v", status, organization)
	}
	status, _ = harness.call("GET", "/api/v1/developer/organizations/"+organizationID, other, nil)
	if status != 404 {
		t.Fatalf("non-member organization detail = %d, want 404", status)
	}
	status, access := harness.call("GET", "/api/v1/developer/organizations/"+organizationID+"/access", owner, nil)
	if status != 200 || access["role"] != "owner" || access["applicationGrantRequired"] != true {
		t.Fatalf("owner access = %d %v", status, access)
	}
	if _, ok := access["organizationCapabilities"].([]any); !ok {
		t.Fatalf("organization capabilities missing: %v", access)
	}
	status, roleCatalog := harness.call("GET", "/api/v1/developer/organizations/"+organizationID+"/roles", owner, nil)
	roles, ok := roleCatalog["roles"].([]any)
	if status != 200 || !ok || len(roles) != 5 {
		t.Fatalf("organization role catalog = %d %v", status, roleCatalog)
	}
	status, _ = harness.call("GET", "/api/v1/developer/organizations/"+organizationID+"/roles", other, nil)
	if status != 404 {
		t.Fatalf("non-member role catalog = %d, want 404", status)
	}
	status, memberList := harness.call("GET", "/api/v1/developer/organizations/"+organizationID+"/members", owner, nil)
	members, ok := memberList["members"].([]any)
	if status != 200 || !ok || len(members) != 2 {
		t.Fatalf("owner member list = %d %v", status, memberList)
	}
	status, forbidden := harness.call("GET", "/api/v1/developer/organizations/"+organizationID+"/members", other, nil)
	if status != 403 || forbidden["code"] != "FORBIDDEN" {
		t.Fatalf("developer member list = %d %v, want forbidden", status, forbidden)
	}
	var memberID string
	harness.queryRow("SELECT m.id::text FROM developer_organization_memberships m JOIN accounts a ON a.id = m.account_id JOIN developer_organizations o ON o.id = m.organization_id WHERE a.email = 'developer-other@example.com' AND o.slug = 'nantty-integrations'", &memberID)
	status, memberDetail := harness.call("GET", "/api/v1/developer/organizations/"+organizationID+"/members/"+memberID, owner, nil)
	if status != 200 || memberDetail["accountId"] != otherAccountID || memberDetail["role"] != "developer" {
		t.Fatalf("owner member detail = %d %v", status, memberDetail)
	}
	status, _ = harness.call("GET", "/api/v1/developer/organizations/"+organizationID+"/members/"+memberID, other, nil)
	if status != 403 {
		t.Fatalf("developer member detail = %d, want forbidden", status)
	}
	status, adminRole := harness.call("PATCH", "/api/v1/developer/organizations/"+organizationID+"/members/"+memberID, owner, map[string]string{"role": "admin"})
	if status != 200 || adminRole["role"] != "admin" {
		t.Fatalf("owner promotion to admin = %d %v", status, adminRole)
	}
	status, adminEscalation := harness.call("PATCH", "/api/v1/developer/organizations/"+organizationID+"/members/"+memberID, other, map[string]string{"role": "billing"})
	if status != 403 || adminEscalation["code"] != "FORBIDDEN" {
		t.Fatalf("admin billing-role grant = %d %v, want forbidden", status, adminEscalation)
	}
	status, changedRole := harness.call("PATCH", "/api/v1/developer/organizations/"+organizationID+"/members/"+memberID, owner, map[string]string{"role": "billing"})
	if status != 200 || changedRole["role"] != "billing" {
		t.Fatalf("owner role update = %d %v", status, changedRole)
	}
	var auditCount int
	harness.queryRow("SELECT count(*) FROM developer_organization_audit_logs l JOIN developer_organizations o ON o.id = l.organization_id WHERE o.slug = 'nantty-integrations' AND l.action = 'organization.member_role_changed'", &auditCount)
	if auditCount != 2 {
		t.Fatalf("member role change audit count = %d, want 2", auditCount)
	}
	status, ownership := harness.call("PATCH", "/api/v1/developer/organizations/"+organizationID+"/members/"+memberID, owner, map[string]string{"role": "owner"})
	if status != 409 || ownership["code"] != "OWNERSHIP_TRANSFER_REQUIRED" {
		t.Fatalf("owner role assignment = %d %v, want ownership conflict", status, ownership)
	}
	status, forbiddenUpdate := harness.call("PATCH", "/api/v1/developer/organizations/"+organizationID+"/members/"+memberID, other, map[string]string{"role": "admin"})
	if status != 403 || forbiddenUpdate["code"] != "FORBIDDEN" {
		t.Fatalf("billing member role update = %d %v, want forbidden", status, forbiddenUpdate)
	}
	status, forbiddenRemoval := harness.call("DELETE", "/api/v1/developer/organizations/"+organizationID+"/members/"+memberID, other, nil)
	if status != 403 || forbiddenRemoval["code"] != "FORBIDDEN" {
		t.Fatalf("billing member removal = %d %v, want forbidden", status, forbiddenRemoval)
	}
	var ownerMemberID string
	harness.queryRow("SELECT m.id::text FROM developer_organization_memberships m JOIN accounts a ON a.id = m.account_id JOIN developer_organizations o ON o.id = m.organization_id WHERE a.email = 'developer-owner@example.com' AND o.slug = 'nantty-integrations'", &ownerMemberID)
	status, ownership = harness.call("DELETE", "/api/v1/developer/organizations/"+organizationID+"/members/"+ownerMemberID, owner, nil)
	if status != 409 || ownership["code"] != "OWNERSHIP_TRANSFER_REQUIRED" {
		t.Fatalf("owner member removal = %d %v, want ownership conflict", status, ownership)
	}
	status, _ = harness.call("DELETE", "/api/v1/developer/organizations/"+organizationID+"/members/"+memberID, owner, nil)
	if status != 204 {
		t.Fatalf("owner removes billing member = %d, want 204", status)
	}
	status, _ = harness.call("GET", "/api/v1/developer/organizations/"+organizationID+"/members/"+memberID, owner, nil)
	if status != 404 {
		t.Fatalf("removed member detail = %d, want 404", status)
	}
	harness.queryRow("SELECT count(*) FROM developer_organization_audit_logs l JOIN developer_organizations o ON o.id = l.organization_id WHERE o.slug = 'nantty-integrations' AND l.action = 'organization.member_removed'", &auditCount)
	if auditCount != 1 {
		t.Fatalf("member removal audit count = %d, want 1", auditCount)
	}
	status, _ = harness.call("GET", "/api/v1/developer/organizations/"+organizationID+"/access", other, nil)
	if status != 404 {
		t.Fatalf("non-member access = %d, want 404", status)
	}
	status, isolated := harness.call("GET", "/api/v1/developer/organizations", other, nil)
	otherOrganizations, ok := isolated["organizations"].([]any)
	if status != 200 || !ok || len(otherOrganizations) != 0 {
		t.Fatalf("other account list = %d %v", status, isolated)
	}
	status, conflict := create(uuid.NewString())
	if status != 409 || conflict["code"] != "ORGANIZATION_SLUG_TAKEN" {
		t.Fatalf("duplicate slug = %d %v", status, conflict)
	}
	status, _ = harness.call("GET", "/api/v1/developer/organizations", "", nil)
	if status != 401 {
		t.Fatalf("unauthenticated list = %d, want 401", status)
	}
}

func registerDeveloperTestAccount(t *testing.T, harness *authTestHarness, email string) string {
	t.Helper()
	harness.expect("POST", "/api/v1/auth/otp/send", "", map[string]string{"destination": email, "purpose": "signup"}, 200)
	code := harness.lastLoggedOneTimeCode()
	verified := harness.expect("POST", "/api/v1/auth/otp/verify", "", map[string]string{"destination": email, "code": code, "purpose": "signup"}, 200)
	registered := harness.expect("POST", "/api/v1/auth/register", "", map[string]string{
		"email": email, "birthday": "1995-12-10", "password": "analytical1", "otpToken": verified["otpToken"].(string),
	}, 201)
	return registered["accessToken"].(string)
}
