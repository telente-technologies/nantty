package auth_test

import (
	"testing"

	"github.com/google/uuid"
)

func TestDeveloperOrganizationInvitationsRequireRecipientConsent(t *testing.T) {
	harness := startAuthModuleAgainstFreshSchema(t)
	owner := registerDeveloperTestAccount(t, harness, "invitation-owner@example.com")
	invitee := registerDeveloperTestAccount(t, harness, "invitation-invitee@example.com")
	other := registerDeveloperTestAccount(t, harness, "invitation-other@example.com")
	organization := harness.expectWithHeaders("POST", "/api/v1/developer/organizations", owner, map[string]string{"name": "Nantty API Team", "slug": "nantty-api-team"}, map[string]string{"Idempotency-Key": uuid.NewString()}, 201)
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
	if status != 404 || forbidden["code"] != "ORGANIZATION_INVITATION_NOT_FOUND" {
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
	status, forbiddenMemberList := harness.call("GET", path, invitee, nil)
	if status != 403 {
		t.Fatalf("developer member lists invitations = %d %v, want 403", status, forbiddenMemberList)
	}
	status, forbiddenMemberCreate := harness.call("POST", path, invitee, map[string]string{"email": "invitation-other@example.com", "role": "analyst"})
	if status != 403 {
		t.Fatalf("developer member creates invitation = %d %v, want 403", status, forbiddenMemberCreate)
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
	status, revoked := harness.call("POST", path, owner, map[string]string{"email": "invitation-other@example.com", "role": "developer"})
	if status != 201 {
		t.Fatalf("create resend test invitation = %d %v", status, revoked)
	}
	resendID := revoked["id"].(string)
	status, cooldown := harness.call("POST", path+"/"+resendID+"/resend", owner, nil)
	if status != 429 || cooldown["code"] != "ORGANIZATION_INVITATION_RESEND_COOLDOWN" {
		t.Fatalf("immediate resend = %d %v, want 429", status, cooldown)
	}
	harness.execSql("UPDATE developer_organization_invitations SET updated_at = now() - interval '2 minutes' WHERE id = $1", resendID)
	status, resent := harness.call("POST", path+"/"+resendID+"/resend", owner, nil)
	if status != 200 || resent["id"] != resendID || resent["status"] != "pending" {
		t.Fatalf("resend invitation = %d %v", status, resent)
	}
	status, forbiddenResend := harness.call("POST", path+"/"+resendID+"/resend", invitee, nil)
	if status != 403 {
		t.Fatalf("developer member resends invitation = %d %v, want 403", status, forbiddenResend)
	}
	var resentOutbox int
	harness.queryRowWithArgs("SELECT count(*) FROM outbox_events WHERE event_type = 'developerOrganization.invitationCreated' AND subject = $1", []any{resendID}, &resentOutbox)
	if resentOutbox != 2 {
		t.Fatalf("resent invitation outbox events = %d, want 2", resentOutbox)
	}
	harness.expect("DELETE", path+"/"+resendID, owner, nil, 204)
	var auditCount int
	harness.queryRowWithArgs("SELECT count(*) FROM developer_organization_audit_logs WHERE organization_id = $1 AND action LIKE 'organization.invitation_%'", []any{organizationID}, &auditCount)
	if auditCount != 7 {
		t.Fatalf("invitation audit entries = %d, want 7", auditCount)
	}
	status, revokedInvitation := harness.call("POST", path, owner, map[string]string{"email": "invitation-other@example.com", "role": "developer"})
	if status != 201 {
		t.Fatalf("create revoke test invitation = %d %v", status, revokedInvitation)
	}
	revokedID := revokedInvitation["id"].(string)
	harness.expect("DELETE", path+"/"+revokedID, owner, nil, 204)
	status, revokedAccept := harness.call("POST", "/api/v1/developer/invitations/"+revokedID, other, map[string]string{"response": "accept"})
	if status != 409 || revokedAccept["code"] != "ORGANIZATION_INVITATION_CLOSED" {
		t.Fatalf("accept revoked invitation = %d %v", status, revokedAccept)
	}
	status, _ = harness.call("GET", "/api/v1/developer/invitations", "", nil)
	if status != 401 {
		t.Fatalf("unauthenticated invitation inbox = %d, want 401", status)
	}
	status, expiredInvitation := harness.call("POST", path, owner, map[string]string{"email": "invitation-other@example.com", "role": "developer"})
	if status != 201 {
		t.Fatalf("create expiration test invitation = %d %v", status, expiredInvitation)
	}
	expiredID := expiredInvitation["id"].(string)
	harness.execSql("UPDATE developer_organization_invitations SET created_at = now() - interval '2 minutes', expires_at = now() - interval '1 minute', updated_at = now() WHERE id = $1", expiredID)
	expiredInbox := harness.expect("GET", "/api/v1/developer/invitations", other, nil, 200)
	if invitations, ok := expiredInbox["invitations"].([]any); !ok || len(invitations) != 0 {
		t.Fatalf("expired invitation must not appear in the recipient inbox: %v", expiredInbox)
	}
	status, expiredResponse := harness.call("POST", "/api/v1/developer/invitations/"+expiredID, other, map[string]string{"response": "accept"})
	if status != 410 || expiredResponse["code"] != "ORGANIZATION_INVITATION_EXPIRED" {
		t.Fatalf("expired invitation response = %d %v", status, expiredResponse)
	}
	var persistedStatus string
	harness.queryRowWithArgs("SELECT status FROM developer_organization_invitations WHERE id = $1", []any{expiredID}, &persistedStatus)
	if persistedStatus != "expired" {
		t.Fatalf("expired invitation status = %q, want expired", persistedStatus)
	}
	var expiredMemberships int
	harness.queryRowWithArgs("SELECT count(*) FROM developer_organization_memberships WHERE organization_id = $1 AND account_id = (SELECT invitee_account_id FROM developer_organization_invitations WHERE id = $2)", []any{organizationID, expiredID}, &expiredMemberships)
	if expiredMemberships != 0 {
		t.Fatal("expired invitation must not create organization membership")
	}
}
