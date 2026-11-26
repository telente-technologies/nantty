package auth_test

import (
	"net/http"
	"net/url"
	"testing"

	"github.com/google/uuid"
)

func TestBusinessConsentDenialReturnsOnlyAllowlistedCallbackAndState(t *testing.T) {
	harness := startAuthModuleAgainstFreshSchema(t)
	developer := registerDeveloperTestAccount(t, harness, "consent-denial-owner@example.com")
	customer := registerDeveloperTestAccount(t, harness, "consent-denial-customer@example.com")
	organization := harness.expectWithHeaders("POST", "/api/v1/developer/organizations", developer,
		map[string]string{"name": "Consent Denial Org", "slug": "consent-denial-org"},
		map[string]string{"Idempotency-Key": uuid.NewString()}, http.StatusCreated)
	redirectURI := "https://merchant.example/nantty/callback?source=settings"
	application := harness.expectWithHeaders("POST", "/api/v1/developer/organizations/"+organization["id"].(string)+"/applications", developer,
		map[string]any{
			"name": "Consent Denial App", "purpose": "Request customer consent for business messaging.",
			"callbackOrigins": []string{"https://merchant.example"}, "redirectUris": []string{redirectURI},
			"requestedScopes": []string{"messages:send"},
		}, map[string]string{"Idempotency-Key": uuid.NewString()}, http.StatusCreated)
	applicationID := application["id"].(string)
	storeID := uuid.NewString()
	var developerID string
	harness.queryRowWithArgs("SELECT id FROM accounts WHERE email=$1", []any{"consent-denial-owner@example.com"}, &developerID)
	harness.execSql("UPDATE developer_applications SET status='approved' WHERE id=$1", applicationID)
	harness.execSql(`INSERT INTO developer_business_authorizations
		(id, organization_id, application_id, store_id, store_name, granted_by_account_id, status, scopes, granted_at)
		VALUES ($1,$2,$3,$4,'Consent Denial Store',$5,'active',$6::jsonb,now())`,
		uuid.NewString(), organization["id"], applicationID, storeID, developerID, `["messages:send"]`)
	path := "/api/v1/account/business-messaging/applications/" + applicationID + "/stores/" + storeID + "/consent-denial"
	request := map[string]any{"authorization": map[string]string{
		"redirectUri": redirectURI, "codeChallenge": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
		"codeChallengeMethod": "S256", "state": "customer-declined-request-state",
	}}
	if status, _ := harness.call("POST", path, "", request); status != http.StatusUnauthorized {
		t.Fatalf("anonymous consent denial = %d, want 401", status)
	}
	denial := harness.expect("POST", path, customer, request, http.StatusOK)
	callback, err := url.Parse(denial["authorizationRedirectUrl"].(string))
	if err != nil || callback.Scheme != "https" || callback.Host != "merchant.example" || callback.EscapedPath() != "/nantty/callback" ||
		callback.Query().Get("source") != "settings" || callback.Query().Get("state") != "customer-declined-request-state" || callback.Query().Get("error") != "access_denied" || callback.Query().Get("code") != "" {
		t.Fatalf("denial callback is not safely bound to the registered redirect and original state: %v, err=%v", callback, err)
	}
	if status, _ := harness.call("POST", path, customer, map[string]any{"authorization": map[string]string{
		"redirectUri": "https://attacker.example/callback", "codeChallenge": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
		"codeChallengeMethod": "S256", "state": "customer-declined-request-state",
	}}); status != http.StatusBadRequest {
		t.Fatalf("unregistered denial callback = %d, want 400", status)
	}
	var consents, codes int
	harness.queryRowWithArgs("SELECT count(*) FROM developer_business_consents WHERE application_id=$1 AND store_id=$2", []any{applicationID, storeID}, &consents)
	harness.queryRowWithArgs("SELECT count(*) FROM developer_business_consent_authorization_codes WHERE application_id=$1 AND store_id=$2", []any{applicationID, storeID}, &codes)
	if consents != 0 || codes != 0 {
		t.Fatalf("denial persisted consent/code records: consents=%d codes=%d", consents, codes)
	}
	harness.execSql("UPDATE developer_business_authorizations SET status='revoked' WHERE application_id=$1 AND store_id=$2", applicationID, storeID)
	if status, _ := harness.call("POST", path, customer, request); status != http.StatusNotFound {
		t.Fatalf("denial after merchant grant revocation = %d, want 404", status)
	}
}
