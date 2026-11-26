package auth_test

import (
	"testing"

	"github.com/google/uuid"
)

func TestBusinessMessagingConsentIsAccountControlledAndAudited(t *testing.T) {
	harness := startAuthModuleAgainstFreshSchema(t)
	developer := registerDeveloperTestAccount(t, harness, "consent-app-owner@example.com")
	customer := registerDeveloperTestAccount(t, harness, "consent-customer@example.com")
	outsider := registerDeveloperTestAccount(t, harness, "consent-outsider@example.com")
	organization := harness.expectWithHeaders("POST", "/api/v1/developer/organizations", developer, map[string]string{"name": "Consent Test Org", "slug": "consent-test-org"}, map[string]string{"Idempotency-Key": uuid.NewString()}, 201)
	organizationID := organization["id"].(string)
	created := harness.expectWithHeaders("POST", "/api/v1/developer/organizations/"+organizationID+"/applications", developer, map[string]any{
		"name": "Customer Inbox", "purpose": "Read and send authorized customer-service messages for the business.",
		"callbackOrigins": []string{"https://inbox.example.com"}, "requestedScopes": []string{"messages:send", "messages:read", "conversations:read"},
	}, map[string]string{"Idempotency-Key": uuid.NewString()}, 201)
	applicationID := created["id"].(string)
	storeID := uuid.NewString()
	harness.execSql("UPDATE developer_applications SET status='approved' WHERE id=$1", applicationID)
	var developerID string
	harness.queryRowWithArgs("SELECT id FROM accounts WHERE email=$1", []any{"consent-app-owner@example.com"}, &developerID)
	grant := uuid.NewString()
	harness.execSql("INSERT INTO developer_business_authorizations (id, organization_id, application_id, store_id, store_name, granted_by_account_id, status, scopes, granted_at) VALUES ($1,$2,$3,$4,'Consent Test Store',$5,'active',$6::jsonb,now())", grant, organizationID, applicationID, storeID, developerID, `["messages:send","messages:read","conversations:read"]`)
	path := "/api/v1/account/business-messaging/consents"
	if result := harness.expect("GET", path, customer, nil, 200); len(result["consents"].([]any)) != 0 {
		t.Fatalf("initial consent list = %v", result)
	}
	status, _ := harness.call("POST", path, customer, map[string]any{"organizationId": organizationID, "applicationId": applicationID, "storeId": storeID, "scopes": []string{"messages:send", "billing:manage"}})
	if status != 400 {
		t.Fatalf("unsupported consent scope = %d, want 400", status)
	}
	consentStatus, consent := harness.call("POST", path, customer, map[string]any{"organizationId": organizationID, "applicationId": applicationID, "storeId": storeID, "scopes": []string{"messages:send", "conversations:read"}})
	if consentStatus != 201 {
		t.Fatalf("grant consent returned %d: %v; logs: %s", consentStatus, consent, harness.logs.String())
	}
	consentID := consent["id"].(string)
	if consent["status"] != "active" || consent["storeId"] != storeID || len(consent["scopes"].([]any)) != 2 {
		t.Fatalf("created consent = %v", consent)
	}
	updatedStatus, updated := harness.call("POST", path, customer, map[string]any{"organizationId": organizationID, "applicationId": applicationID, "storeId": storeID, "scopes": []string{"messages:read"}})
	if updatedStatus != 201 {
		t.Fatalf("update consent returned %d: %v; logs: %s", updatedStatus, updated, harness.logs.String())
	}
	if updated["id"] != consentID || len(updated["scopes"].([]any)) != 1 || updated["scopes"].([]any)[0] != "messages:read" {
		t.Fatalf("updated consent = %v", updated)
	}
	otherAuthorizedStoreID := uuid.NewString()
	harness.execSql("INSERT INTO developer_business_authorizations (id, organization_id, application_id, store_id, store_name, granted_by_account_id, status, scopes, granted_at) VALUES ($1,$2,$3,$4,'Second Consent Store',$5,'active',$6::jsonb,now())", uuid.NewString(), organizationID, applicationID, otherAuthorizedStoreID, developerID, `["messages:send"]`)
	otherConsentStatus, otherConsent := harness.call("POST", path, customer, map[string]any{"organizationId": organizationID, "applicationId": applicationID, "storeId": otherAuthorizedStoreID, "scopes": []string{"messages:send"}})
	if otherConsentStatus != 201 {
		t.Fatalf("grant second-store consent returned %d: %v; logs: %s", otherConsentStatus, otherConsent, harness.logs.String())
	}
	if otherConsent["id"] == consentID || otherConsent["storeId"] != otherAuthorizedStoreID {
		t.Fatalf("consents for separate stores must be independent: first=%v second=%v", consent, otherConsent)
	}
	otherStoreConsent := harness.expect("POST", path, customer, map[string]any{"organizationId": organizationID, "applicationId": applicationID, "storeId": uuid.NewString(), "scopes": []string{"messages:send"}}, 404)
	if otherStoreConsent["code"] != "BUSINESS_CONSENT_NOT_FOUND" {
		t.Fatalf("consent without a matching active store grant = %v", otherStoreConsent)
	}
	if _, body := harness.call("DELETE", path+"/"+consentID, outsider, nil); body["code"] != "BUSINESS_CONSENT_NOT_FOUND" {
		t.Fatalf("foreign-account consent revoke response = %v", body)
	}
	if status, _ := harness.call("DELETE", path+"/"+consentID, customer, nil); status != 204 {
		t.Fatalf("revoke consent = %d, want 204", status)
	}
	if status, _ := harness.call("DELETE", path+"/"+consentID, customer, nil); status != 404 {
		t.Fatalf("repeat revoke = %d, want 404", status)
	}
	items := harness.expect("GET", path, customer, nil, 200)["consents"].([]any)
	statusesByStore := make(map[string]string, len(items))
	for _, raw := range items {
		consentItem := raw.(map[string]any)
		statusesByStore[consentItem["storeId"].(string)] = consentItem["status"].(string)
	}
	if len(items) != 2 || statusesByStore[storeID] != "revoked" || statusesByStore[otherAuthorizedStoreID] != "active" {
		t.Fatalf("revoked consent not retained in management view: %v", items)
	}
	var grantEvents, updateEvents, revokeEvents int
	harness.queryRowWithArgs("SELECT count(*) FILTER (WHERE action='granted'), count(*) FILTER (WHERE action='updated'), count(*) FILTER (WHERE action='revoked') FROM developer_business_consent_audit_logs WHERE recipient_account_id=(SELECT id FROM accounts WHERE email='consent-customer@example.com')", nil, &grantEvents, &updateEvents, &revokeEvents)
	if grantEvents != 2 || updateEvents != 1 || revokeEvents != 1 {
		t.Fatalf("consent audit events grant/update/revoke = %d/%d/%d", grantEvents, updateEvents, revokeEvents)
	}
	if status, _ := harness.call("GET", path, "", nil); status != 401 {
		t.Fatalf("unauthenticated consent list = %d, want 401", status)
	}
}

func TestBusinessMessagingConsentRequiresApprovedApplicationAndRequestedScopes(t *testing.T) {
	harness := startAuthModuleAgainstFreshSchema(t)
	developer := registerDeveloperTestAccount(t, harness, "consent-pending-owner@example.com")
	customer := registerDeveloperTestAccount(t, harness, "consent-pending-customer@example.com")
	organization := harness.expectWithHeaders("POST", "/api/v1/developer/organizations", developer, map[string]string{"name": "Pending Consent Org", "slug": "pending-consent-org"}, map[string]string{"Idempotency-Key": uuid.NewString()}, 201)
	created := harness.expectWithHeaders("POST", "/api/v1/developer/organizations/"+organization["id"].(string)+"/applications", developer, map[string]any{
		"name": "Pending Inbox", "purpose": "Request consent for customer messaging access while waiting for approval.",
		"callbackOrigins": []string{"https://pending.example.com"}, "requestedScopes": []string{"messages:send"},
	}, map[string]string{"Idempotency-Key": uuid.NewString()}, 201)
	path := "/api/v1/account/business-messaging/consents"
	status, _ := harness.call("POST", path, customer, map[string]any{"organizationId": organization["id"], "applicationId": created["id"], "storeId": uuid.NewString(), "scopes": []string{"messages:send"}})
	if status != 404 {
		t.Fatalf("pending app consent = %d, want 404", status)
	}
	harness.execSql("UPDATE developer_applications SET status='approved' WHERE id=$1", created["id"])
	status, _ = harness.call("POST", path, customer, map[string]any{"organizationId": organization["id"], "applicationId": created["id"], "storeId": uuid.NewString(), "scopes": []string{"messages:read"}})
	if status != 400 {
		t.Fatalf("unrequested consent scope = %d, want 400", status)
	}
}
