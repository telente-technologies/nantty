package auth_test

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"net/url"
	"testing"

	"github.com/google/uuid"
)

func TestBusinessConsentAuthorizationCodeIsRedirectBoundSingleUseAndPKCEProtected(t *testing.T) {
	harness := startAuthModuleAgainstFreshSchema(t)
	developer := registerDeveloperTestAccount(t, harness, "consent-code-owner@example.com")
	customer := registerDeveloperTestAccount(t, harness, "consent-code-customer@example.com")
	organization := harness.expectWithHeaders("POST", "/api/v1/developer/organizations", developer,
		map[string]string{"name": "Consent Code Org", "slug": "consent-code-org"},
		map[string]string{"Idempotency-Key": uuid.NewString()}, 201)
	redirectURI := "https://merchant.example/nantty/callback?source=account"
	application := harness.expectWithHeaders("POST", "/api/v1/developer/organizations/"+organization["id"].(string)+"/applications", developer,
		map[string]any{
			"name": "Consent Code App", "purpose": "Exchange explicit customer approvals for a verified consent receipt.",
			"callbackOrigins": []string{"https://merchant.example"}, "redirectUris": []string{redirectURI},
			"requestedScopes": []string{"messages:send", "conversations:read"},
		}, map[string]string{"Idempotency-Key": uuid.NewString()}, 201)
	applicationID := application["id"].(string)
	storeID := uuid.NewString()
	var developerID string
	harness.queryRowWithArgs("SELECT id FROM accounts WHERE email=$1", []any{"consent-code-owner@example.com"}, &developerID)
	harness.execSql("UPDATE developer_applications SET status='approved' WHERE id=$1", applicationID)
	harness.execSql(`INSERT INTO developer_business_authorizations
		(id, organization_id, application_id, store_id, store_name, granted_by_account_id, status, scopes, granted_at)
		VALUES ($1,$2,$3,$4,'Consent Code Store',$5,'active',$6::jsonb,now())`, uuid.NewString(), organization["id"], applicationID, storeID, developerID, `["messages:send","conversations:read"]`)
	credential := harness.expect("POST", "/api/v1/developer/organizations/"+organization["id"].(string)+"/applications/"+applicationID+"/credentials", developer,
		map[string]any{"name": "Consent exchange", "scopes": []string{"messages:send", "conversations:read"}}, 201)
	secret := credential["secret"].(string)
	verifier := "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ"
	challengeBytes := sha256.Sum256([]byte(verifier))
	challenge := base64.RawURLEncoding.EncodeToString(challengeBytes[:])
	state := "customer-approved-state-123456"
	query := url.Values{
		"redirect_uri": {redirectURI}, "code_challenge": {challenge},
		"code_challenge_method": {"S256"}, "state": {state},
	}
	previewPath := "/api/v1/account/business-messaging/applications/" + applicationID + "/stores/" + storeID + "/consent-preview?" + query.Encode()
	harness.expect("GET", previewPath, customer, nil, 200)
	invalidQuery := query
	invalidQuery.Set("redirect_uri", "https://attacker.example/callback")
	if status, _ := harness.call("GET", "/api/v1/account/business-messaging/applications/"+applicationID+"/stores/"+storeID+"/consent-preview?"+invalidQuery.Encode(), customer, nil); status != 400 {
		t.Fatalf("unregistered callback preview = %d, want 400", status)
	}
	consentStatus, consent := harness.call("POST", "/api/v1/account/business-messaging/consents", customer, map[string]any{
		"organizationId": organization["id"], "applicationId": applicationID, "storeId": storeID,
		"scopes":        []string{"messages:send", "conversations:read"},
		"authorization": map[string]string{"redirectUri": redirectURI, "codeChallenge": challenge, "codeChallengeMethod": "S256", "state": state},
	})
	if consentStatus != 201 {
		t.Fatalf("grant with authorization code = %d %v; logs=%s", consentStatus, consent, harness.logs.String())
	}
	callback, err := url.Parse(consent["authorizationRedirectUrl"].(string))
	if err != nil || callback.Scheme != "https" || callback.Host != "merchant.example" || callback.EscapedPath() != "/nantty/callback" || callback.Query().Get("source") != "account" || callback.Query().Get("state") != state {
		t.Fatalf("authorization callback is not the exact registered URI with state: %v, err=%v", callback, err)
	}
	code := callback.Query().Get("code")
	if len(code) != 43 {
		t.Fatalf("authorization code length=%d, want 43", len(code))
	}
	exchangePath := "/api/v1/business/consent-codes/exchange"
	requestBody := map[string]string{"code": code, "redirectUri": redirectURI, "codeVerifier": verifier}
	if status, _ := harness.call("POST", exchangePath, "ntlive_invalid", requestBody); status != 401 {
		t.Fatalf("invalid application credential exchange = %d, want 401", status)
	}
	wrongRedirect := map[string]string{"code": code, "redirectUri": "https://attacker.example/callback", "codeVerifier": verifier}
	if status, _ := harness.call("POST", exchangePath, secret, wrongRedirect); status != 401 {
		t.Fatalf("wrong redirect exchange = %d, want 401", status)
	}
	if status, _ := harness.call("POST", exchangePath, secret, map[string]string{"code": code, "redirectUri": redirectURI, "codeVerifier": "wrong-verifier-that-is-long-enough-to-meet-the-check"}); status != 401 {
		t.Fatalf("wrong verifier exchange = %d, want 401", status)
	}
	receipt := harness.expect("POST", exchangePath, secret, requestBody, 200)
	if receipt["consentId"] != consent["id"] || receipt["applicationId"] != applicationID || receipt["storeId"] != storeID || receipt["recipientAccountId"] == "" {
		t.Fatalf("consent exchange receipt lost resource binding: %v", receipt)
	}
	if status, _ := harness.call("POST", exchangePath, secret, requestBody); status != 401 {
		t.Fatalf("replayed authorization code = %d, want 401", status)
	}
	var consumingCredential string
	harness.queryRowWithArgs("SELECT consumed_by_credential_id::text FROM developer_business_consent_authorization_codes WHERE consumed_at IS NOT NULL ORDER BY consumed_at DESC LIMIT 1", nil, &consumingCredential)
	if consumingCredential == "" {
		t.Fatal("code redemption did not record the consuming credential")
	}
	expiredConsent := harness.expect("POST", "/api/v1/account/business-messaging/consents", customer, map[string]any{
		"organizationId": organization["id"], "applicationId": applicationID, "storeId": storeID,
		"scopes":        []string{"messages:send", "conversations:read"},
		"authorization": map[string]string{"redirectUri": redirectURI, "codeChallenge": challenge, "codeChallengeMethod": "S256", "state": "expired-customer-approved-state"},
	}, 201)
	expiredCallback, err := url.Parse(expiredConsent["authorizationRedirectUrl"].(string))
	if err != nil {
		t.Fatal(err)
	}
	expiredCode := expiredCallback.Query().Get("code")
	expiredHash := sha256.Sum256([]byte(expiredCode))
	harness.execSql("UPDATE developer_business_consent_authorization_codes SET expires_at=now()-interval '1 second' WHERE code_hash=$1", hex.EncodeToString(expiredHash[:]))
	if status, _ := harness.call("POST", exchangePath, secret, map[string]string{"code": expiredCode, "redirectUri": redirectURI, "codeVerifier": verifier}); status != 401 {
		t.Fatalf("expired code exchange = %d, want 401", status)
	}
	secondConsent := harness.expect("POST", "/api/v1/account/business-messaging/consents", customer, map[string]any{
		"organizationId": organization["id"], "applicationId": applicationID, "storeId": storeID,
		"scopes":        []string{"messages:send", "conversations:read"},
		"authorization": map[string]string{"redirectUri": redirectURI, "codeChallenge": challenge, "codeChallengeMethod": "S256", "state": "second-customer-approved-state"},
	}, 201)
	secondCallback, err := url.Parse(secondConsent["authorizationRedirectUrl"].(string))
	if err != nil {
		t.Fatal(err)
	}
	secondRequest := map[string]string{"code": secondCallback.Query().Get("code"), "redirectUri": redirectURI, "codeVerifier": verifier}
	if status, _ := harness.call("DELETE", "/api/v1/account/business-messaging/consents/"+consent["id"].(string), customer, nil); status != 204 {
		t.Fatalf("consent revocation = %d, want 204", status)
	}
	if status, _ := harness.call("POST", exchangePath, secret, secondRequest); status != 401 {
		t.Fatalf("code exchange after consent revocation = %d, want 401", status)
	}
	regranted := harness.expect("POST", "/api/v1/account/business-messaging/consents", customer, map[string]any{
		"organizationId": organization["id"], "applicationId": applicationID, "storeId": storeID,
		"scopes":        []string{"messages:send", "conversations:read"},
		"authorization": map[string]string{"redirectUri": redirectURI, "codeChallenge": challenge, "codeChallengeMethod": "S256", "state": "reapproval-customer-state-123"},
	}, 201)
	if regranted["id"] != consent["id"] {
		t.Fatalf("same app/store/customer consent should be reactivated in place: old=%v new=%v", consent["id"], regranted["id"])
	}
	if status, _ := harness.call("POST", exchangePath, secret, secondRequest); status != 401 {
		t.Fatalf("old code became valid after a same-scope regrant = %d, want 401", status)
	}
	newCallback, err := url.Parse(regranted["authorizationRedirectUrl"].(string))
	if err != nil {
		t.Fatal(err)
	}
	newCodeStatus, newReceipt := harness.call("POST", exchangePath, secret, map[string]string{"code": newCallback.Query().Get("code"), "redirectUri": redirectURI, "codeVerifier": verifier})
	if newCodeStatus != 200 || newReceipt["consentId"] != consent["id"] {
		t.Fatalf("new code after reapproval did not redeem: status=%d receipt=%v", newCodeStatus, newReceipt)
	}
}
