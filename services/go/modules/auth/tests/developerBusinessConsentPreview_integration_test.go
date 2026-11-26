package auth_test

import (
	"net/http"
	"testing"

	"github.com/google/uuid"
)

func TestBusinessConsentPreviewRequiresApprovedAppAndActiveStoreGrant(t *testing.T) {
	harness := startAuthModuleAgainstFreshSchema(t)
	developer := registerDeveloperTestAccount(t, harness, "consent-preview-owner@example.com")
	user := registerDeveloperTestAccount(t, harness, "consent-preview-customer@example.com")
	organization := harness.expectWithHeaders("POST", "/api/v1/developer/organizations", developer,
		map[string]string{"name": "Consent Preview Org", "slug": "consent-preview-org"},
		map[string]string{"Idempotency-Key": uuid.NewString()}, http.StatusCreated)
	application := harness.expectWithHeaders("POST", "/api/v1/developer/organizations/"+organization["id"].(string)+"/applications", developer,
		map[string]any{
			"name": "Consent Preview App", "purpose": "Request explicit customer permission for business messaging.",
			"callbackOrigins": []string{"https://consent-preview.example.com"},
			"requestedScopes": []string{"messages:send", "messages:read", "conversations:read"},
		}, map[string]string{"Idempotency-Key": uuid.NewString()}, http.StatusCreated)
	applicationID := application["id"].(string)
	storeID := uuid.NewString()
	path := "/api/v1/account/business-messaging/applications/" + applicationID + "/stores/" + storeID + "/consent-preview"
	if status, body := harness.call("GET", path, user, nil); status != http.StatusNotFound {
		t.Fatalf("draft application preview = %d, want 404: %v; logs=%s", status, body, harness.logs.String())
	}
	harness.execSql("UPDATE developer_applications SET status='approved' WHERE id=$1", applicationID)
	if status, _ := harness.call("GET", path, user, nil); status != http.StatusNotFound {
		t.Fatalf("ungranted store preview = %d, want 404", status)
	}
	harness.execSql(`INSERT INTO developer_business_authorizations
		(id, organization_id, application_id, store_id, store_name, granted_by_account_id, status, scopes, granted_at)
		VALUES ($1, $2, $3, $4, 'Authorized Store', (SELECT id FROM accounts WHERE email=$5), 'active', $6::jsonb, now())`,
		uuid.NewString(), organization["id"], applicationID, storeID, "consent-preview-owner@example.com", `["messages:send","conversations:read"]`)
	preview := harness.expect("GET", path, user, nil, http.StatusOK)
	if preview["applicationId"] != applicationID || preview["organizationId"] != organization["id"] || preview["storeId"] != storeID || preview["storeName"] != "Authorized Store" {
		t.Fatalf("preview identity or store binding is wrong: %v", preview)
	}
	requested := preview["requestedScopes"].([]any)
	available := preview["availableScopes"].([]any)
	if len(requested) != 3 || len(available) != 2 || available[0] != "conversations:read" || available[1] != "messages:send" {
		t.Fatalf("preview did not restrict selectable permissions to the store grant: %v", preview)
	}
	if status, _ := harness.call("GET", path, "", nil); status != http.StatusUnauthorized {
		t.Fatalf("anonymous consent preview = %d, want 401", status)
	}
	if status, _ := harness.call("GET", "/api/v1/account/business-messaging/applications/not-an-id/stores/"+storeID+"/consent-preview", user, nil); status != http.StatusNotFound {
		t.Fatalf("malformed application preview = %d, want 404", status)
	}
	harness.execSql("UPDATE developer_business_authorizations SET status='revoked' WHERE application_id=$1 AND store_id=$2", applicationID, storeID)
	if status, _ := harness.call("GET", path, user, nil); status != http.StatusNotFound {
		t.Fatalf("revoked store grant preview = %d, want 404", status)
	}
}
