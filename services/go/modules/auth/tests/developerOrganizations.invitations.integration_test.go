package auth_test

import "testing"

func TestDeveloperOrganizationInvitationsRequireRecipientConsent(t *testing.T) {
	harness := startAuthModuleAgainstFreshSchema(t)
	owner := registerDeveloperTestAccount(t, harness, "invitation-owner@example.com")
	invitee := registerDeveloperTestAccount(t, harness, "invitation-invitee@example.com")
	other := registerDeveloperTestAccount(t, harness, "invitation-other@example.com")
	organization := harness.expect("POST", "/api/v1/developer/organizations", owner, map[string]string{"name": "Nantty API Team", "slug": "nantty-api-team"}, 201)
	organizationID := organization["id"].(string)
	path := "/api/v1/developer/organizations/" + organizationID + "/invitations"
	status, invalid := harness.call("POST", path, owner, map[string]string{"email": "not-an-email", "role": "developer"})
	if status != 400 || invalid["code"] != "INVALID_ORGANIZATION_INVITATION" {
		t.Fatalf("invalid invitation = %d %v", status, invalid)
	}
	status, invitation := harness.call("POST", path, owner, map[string]string{"email": "INVITATION-INVITEE@example.com", "role": "developer"})
	if status != 201 || invitation["status"] != "pending" || invitation["inviteeEmail"] != "invitation-invitee@example.com" {
		t.Fatalf("create invitation = %d %v", status, invitation)
	}
	inbox := harness.expect("GET", "/api/v1/developer/invitations", invitee, nil, 200)
	items, ok := inbox["invitations"].([]any)
	if !ok || len(items) != 1 {
		t.Fatalf("recipient inbox = %v", inbox)
	}
	invitationID := invitation["id"].(string)
	status, forbidden := harness.call("GET", path, other, nil)
	if status != 404 || forbidden["code"] != "ORGANIZATION_NOT_FOUND" {
		t.Fatalf("non-member invitation listing = %d %v", status, forbidden)
	}
	status, unauthorized := harness.call("POST", "/api/v1/developer/invitations/"+invitationID, other, map[string]string{"response": "accept"})
	if status != 404 || unauthorized["code"] != "ORGANIZATION_INVITATION_NOT_FOUND" {
		t.Fatalf("other account accepts invitation = %d %v", status, unauthorized)
	}
	status, duplicate := harness.call("POST", path, owner, map[string]string{"email": "invitation-invitee@example.com", "role": "analyst"})
	if status != 409 || duplicate["code"] != "ORGANIZATION_INVITATION_EXISTS" {
		t.Fatalf("duplicate pending invitation = %d %v", status, duplicate)
	}
	harness.expect("POST", "/api/v1/developer/invitations/"+invitationID, invitee, map[string]string{"response": "accept"}, 204)
	joined := harness.expect("GET", "/api/v1/developer/organizations/"+organizationID, invitee, nil, 200)
	if joined["role"] != "developer" {
		t.Fatalf("accepted invite role = %v", joined["role"])
	}
	status, duplicateMembership := harness.call("POST", path, owner, map[string]string{"email": "invitation-invitee@example.com", "role": "developer"})
	if status != 409 || duplicateMembership["code"] != "ORGANIZATION_INVITATION_EXISTS" {
		t.Fatalf("invite existing member = %d %v", status, duplicateMembership)
	}
	status, declinedInvitation := harness.call("POST", path, owner, map[string]string{"email": "invitation-other@example.com", "role": "analyst"})
	if status != 201 {
		t.Fatalf("create decline test invitation = %d %v", status, declinedInvitation)
	}
	declinedID := declinedInvitation["id"].(string)
	harness.expect("POST", "/api/v1/developer/invitations/"+declinedID, other, map[string]string{"response": "decline"}, 204)
	status, closed := harness.call("POST", "/api/v1/developer/invitations/"+declinedID, other, map[string]string{"response": "accept"})
	if status != 409 || closed["code"] != "ORGANIZATION_INVITATION_CLOSED" {
		t.Fatalf("respond to declined invitation = %d %v", status, closed)
	}
	status, revokedInvitation := harness.call("POST", path, owner, map[string]string{"email": "invitation-other@example.com", "role": "developer"})
	if status != 201 {
		t.Fatalf("create revoke test invitation = %d %v", status, revokedInvitation)
	}
	revokedID := revokedInvitation["id"].(string)
	harness.expect("DELETE", path+"/"+revokedID, owner, nil, 204)
	status, revoked := harness.call("POST", "/api/v1/developer/invitations/"+revokedID, other, map[string]string{"response": "accept"})
	if status != 409 || revoked["code"] != "ORGANIZATION_INVITATION_CLOSED" {
		t.Fatalf("accept revoked invitation = %d %v", status, revoked)
	}
	var auditCount int
	harness.queryRow("SELECT count(*) FROM developer_organization_audit_logs WHERE organization_id = $1 AND action LIKE 'organization.invitation_%'", &auditCount, organizationID)
	if auditCount != 6 {
		t.Fatalf("invitation audit entries = %d, want 6", auditCount)
	}
	status, _ = harness.call("GET", "/api/v1/developer/invitations", "", nil)
	if status != 401 {
		t.Fatalf("unauthenticated invitation inbox = %d, want 401", status)
	}
}
