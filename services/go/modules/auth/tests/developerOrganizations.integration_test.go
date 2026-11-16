package auth_test

import (
	"bytes"
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
	if status != 200 {
		t.Fatalf("developer organization detail = %d, want 200", status)
	}
	status, access := harness.call("GET", "/api/v1/developer/organizations/"+organizationID+"/access", owner, nil)
	if status != 200 || access["role"] != "owner" || access["applicationGrantRequired"] != true {
		t.Fatalf("owner access = %d %v", status, access)
	}
	if capabilities, ok := access["applicationCapabilities"].([]any); !ok || len(capabilities) != 0 {
		t.Fatalf("ungranted application capabilities must be empty: %v", access)
	}
	if capabilities, ok := access["eligibleApplicationCapabilities"].([]any); !ok || len(capabilities) == 0 {
		t.Fatalf("eligible application capabilities missing: %v", access)
	}
	if _, ok := access["organizationCapabilities"].([]any); !ok {
		t.Fatalf("organization capabilities missing: %v", access)
	}
	status, roleCatalog := harness.call("GET", "/api/v1/developer/organizations/"+organizationID+"/roles", owner, nil)
	roles, ok := roleCatalog["roles"].([]any)
	if status != 200 || !ok || len(roles) != 5 {
		t.Fatalf("organization role catalog = %d %v", status, roleCatalog)
	}
	status, otherRoleCatalog := harness.call("GET", "/api/v1/developer/organizations/"+organizationID+"/roles", other, nil)
	if status != 200 || len(otherRoleCatalog["roles"].([]any)) != 5 {
		t.Fatalf("developer role catalog = %d %v, want 200 and five roles", status, otherRoleCatalog)
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
	status, auditLog := harness.call("GET", "/api/v1/developer/organizations/"+organizationID+"/audit-log?limit=10", owner, nil)
	auditEntries, ok := auditLog["entries"].([]any)
	if status != 200 || !ok || len(auditEntries) < 3 {
		t.Fatalf("owner audit log = %d %v", status, auditLog)
	}
	status, forbiddenAudit := harness.call("GET", "/api/v1/developer/organizations/"+organizationID+"/audit-log", other, nil)
	if status != 403 || forbiddenAudit["code"] != "FORBIDDEN" {
		t.Fatalf("billing audit access = %d %v, want forbidden", status, forbiddenAudit)
	}
	status, changedOrganization := harness.call("PATCH", "/api/v1/developer/organizations/"+organizationID, owner, map[string]string{"name": "Nantty Developer Team", "slug": "nantty-integrations"})
	if status != 200 || changedOrganization["name"] != "Nantty Developer Team" {
		t.Fatalf("owner organization update = %d %v", status, changedOrganization)
	}
	status, forbiddenOrganizationUpdate := harness.call("PATCH", "/api/v1/developer/organizations/"+organizationID, other, map[string]string{"name": "Unauthorized", "slug": "nantty-integrations"})
	if status != 403 || forbiddenOrganizationUpdate["code"] != "FORBIDDEN" {
		t.Fatalf("billing organization update = %d %v, want forbidden", status, forbiddenOrganizationUpdate)
	}
	harness.queryRow("SELECT count(*) FROM developer_organization_audit_logs l JOIN developer_organizations o ON o.id = l.organization_id WHERE o.slug = 'nantty-integrations' AND l.action = 'organization.updated'", &auditCount)
	if auditCount != 1 {
		t.Fatalf("organization update audit count = %d, want 1", auditCount)
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
	status, otherAccess := harness.call("GET", "/api/v1/developer/organizations/"+organizationID+"/access", other, nil)
	if status != 404 {
		t.Fatalf("removed developer access = %d %v, want 404", status, otherAccess)
	}
	status, isolated := harness.call("GET", "/api/v1/developer/organizations", other, nil)
	otherOrganizations, ok := isolated["organizations"].([]any)
	if status != 200 || !ok || len(otherOrganizations) != 0 {
		t.Fatalf("removed developer organization list = %d %v", status, isolated)
	}
	status, conflict := create(uuid.NewString())
	if status != 409 || conflict["code"] != "ORGANIZATION_SLUG_TAKEN" {
		t.Fatalf("duplicate slug = %d %v", status, conflict)
	}
	harness.execSql("INSERT INTO developer_organization_memberships (id, organization_id, account_id, role, created_at) VALUES ($1, $2, $3, 'developer', now())", uuid.NewString(), organizationID, otherAccountID)
	var transferTargetID string
	harness.queryRow("SELECT m.id::text FROM developer_organization_memberships m JOIN accounts a ON a.id = m.account_id JOIN developer_organizations o ON o.id = m.organization_id WHERE a.email = 'developer-other@example.com' AND o.slug = 'nantty-integrations'", &transferTargetID)
	stepUp := harness.expect("POST", "/api/v1/auth/step-up", owner, map[string]string{"password": "analytical1"}, http.StatusOK)["stepUpToken"].(string)
	transferPath := "/api/v1/developer/organizations/" + organizationID + "/ownership-transfer"
	status, missingStepUp := callDeveloperOwnershipTransfer(t, harness, transferPath, owner, "", map[string]string{"memberId": transferTargetID, "confirmation": "TRANSFER OWNERSHIP"})
	if status != http.StatusForbidden || missingStepUp["code"] != "STEP_UP_REQUIRED" {
		t.Fatalf("ownership transfer without fresh identity proof = %d %v", status, missingStepUp)
	}
	status, badConfirmation := callDeveloperOwnershipTransfer(t, harness, transferPath, owner, stepUp, map[string]string{"memberId": transferTargetID, "confirmation": "transfer"})
	if status != http.StatusBadRequest || badConfirmation["code"] != "OWNERSHIP_TRANSFER_CONFIRMATION_REQUIRED" {
		t.Fatalf("ownership transfer without confirmation phrase = %d %v", status, badConfirmation)
	}
	status, transfer := callDeveloperOwnershipTransfer(t, harness, transferPath, owner, stepUp, map[string]string{"memberId": transferTargetID, "confirmation": "TRANSFER OWNERSHIP"})
	if status != http.StatusOK || transfer["previousOwnerMembershipId"] != ownerMemberID || transfer["newOwnerMembershipId"] != transferTargetID {
		t.Fatalf("ownership transfer = %d %v", status, transfer)
	}
	status, formerOwner := harness.call("GET", "/api/v1/developer/organizations/"+organizationID, owner, nil)
	if status != http.StatusOK || formerOwner["role"] != "admin" {
		t.Fatalf("former owner role after transfer = %d %v", status, formerOwner)
	}
	status, newOwner := harness.call("GET", "/api/v1/developer/organizations/"+organizationID, other, nil)
	if status != http.StatusOK || newOwner["role"] != "owner" {
		t.Fatalf("new owner role after transfer = %d %v", status, newOwner)
	}
	harness.queryRow("SELECT count(*) FROM developer_organization_audit_logs l JOIN developer_organizations o ON o.id = l.organization_id WHERE o.slug = 'nantty-integrations' AND l.action = 'organization.ownership_transferred'", &auditCount)
	if auditCount != 1 {
		t.Fatalf("ownership transfer audit count = %d, want 1", auditCount)
	}
	status, _ = harness.call("GET", "/api/v1/developer/organizations", "", nil)
	if status != 401 {
		t.Fatalf("unauthenticated list = %d, want 401", status)
	}
}

func callDeveloperOwnershipTransfer(t *testing.T, harness *authTestHarness, path, accessToken, stepUpToken string, body any) (int, map[string]any) {
	t.Helper()
	encoded, err := json.Marshal(body)
	if err != nil {
		t.Fatal(err)
	}
	request, err := http.NewRequest(http.MethodPost, harness.server.URL+path, bytes.NewReader(encoded))
	if err != nil {
		t.Fatal(err)
	}
	request.Header.Set("Authorization", "Bearer "+accessToken)
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Forwarded-For", harness.clientIp)
	if stepUpToken != "" {
		request.Header.Set("X-Step-Up-Token", stepUpToken)
	}
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	result := map[string]any{}
	if err := json.NewDecoder(response.Body).Decode(&result); err != nil && response.StatusCode != http.StatusNoContent {
		t.Fatal(err)
	}
	return response.StatusCode, result
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
