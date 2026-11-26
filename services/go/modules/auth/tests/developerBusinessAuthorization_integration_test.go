package auth_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"nantty/modules/auth/src/configs"
)

func TestBusinessAuthorizationRequiresCommercePermissionAndAuditsLifecycle(t *testing.T) {
	var expectedStore uuid.UUID
	var checkedAccount, checkedStore string
	denyStore := false
	commerce := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodPost || request.URL.Path != "/api/v1/internal/business-messaging/store-access" {
			t.Errorf("unexpected Commerce request %s %s", request.Method, request.URL.Path)
			http.NotFound(writer, request)
			return
		}
		if request.Header.Get("X-Business-Messaging-Authorization-Token") != "business-auth-test-secret" {
			http.Error(writer, "unauthorized", http.StatusUnauthorized)
			return
		}
		var input struct {
			AccountID string `json:"accountId"`
			StoreID   string `json:"storeId"`
		}
		if err := json.NewDecoder(request.Body).Decode(&input); err != nil {
			t.Errorf("decode Commerce access request: %v", err)
			http.Error(writer, "invalid", http.StatusBadRequest)
			return
		}
		checkedAccount, checkedStore = input.AccountID, input.StoreID
		if denyStore || input.StoreID != expectedStore.String() {
			http.Error(writer, "forbidden", http.StatusForbidden)
			return
		}
		writer.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(writer).Encode(map[string]string{
			"storeId": input.StoreID, "storeName": "Test Business", "ownerAccountId": input.AccountID, "role": "owner",
		})
	}))
	defer commerce.Close()

	harness := startAuthModuleAgainstFreshSchema(t, func(settings *configs.AuthSettings) {
		settings.BusinessMessagingCommerceUrl = commerce.URL
		settings.BusinessMessagingAuthorizationToken = "business-auth-test-secret"
	})
	developer := registerDeveloperTestAccount(t, harness, "business-auth-app-owner@example.com")
	storeOwner := registerDeveloperTestAccount(t, harness, "business-auth-store-owner@example.com")
	outsider := registerDeveloperTestAccount(t, harness, "business-auth-outsider@example.com")
	customer := registerDeveloperTestAccount(t, harness, "business-auth-customer@example.com")
	organization := harness.expectWithHeaders("POST", "/api/v1/developer/organizations", developer, map[string]string{"name": "Business Auth Org", "slug": "business-auth-org"}, map[string]string{"Idempotency-Key": uuid.NewString()}, http.StatusCreated)
	app := harness.expectWithHeaders("POST", "/api/v1/developer/organizations/"+organization["id"].(string)+"/applications", developer, map[string]any{
		"name": "Business Auth Client", "purpose": "Connect an approved business messaging app to a store with explicit owner authorization.",
		"callbackOrigins": []string{"https://business-auth.example.com"}, "requestedScopes": []string{"messages:send", "messages:read", "conversations:read"},
	}, map[string]string{"Idempotency-Key": uuid.NewString()}, http.StatusCreated)
	appID := app["id"].(string)
	harness.execSql("UPDATE developer_applications SET status='approved' WHERE id=$1", appID)
	expectedStore = uuid.New()
	path := "/api/v1/account/business-messaging/authorizations"
	created := harness.expect("POST", path, storeOwner, map[string]any{
		"organizationId": organization["id"], "applicationId": appID, "storeId": expectedStore.String(), "scopes": []string{"messages:send", "conversations:read"},
	}, http.StatusCreated)
	if created["storeName"] != "Test Business" || created["status"] != "active" {
		t.Fatalf("unexpected business authorization: %v", created)
	}
	var expectedAccount uuid.UUID
	harness.queryRowWithArgs("SELECT id FROM accounts WHERE email=$1", []any{"business-auth-store-owner@example.com"}, &expectedAccount)
	var customerAccount uuid.UUID
	harness.queryRowWithArgs("SELECT id FROM accounts WHERE email=$1", []any{"business-auth-customer@example.com"}, &customerAccount)
	if checkedAccount != expectedAccount.String() || checkedStore != expectedStore.String() {
		t.Fatalf("Commerce received actor/store %q/%q, want %q/%q", checkedAccount, checkedStore, expectedAccount, expectedStore)
	}
	consent := harness.expect("POST", "/api/v1/account/business-messaging/consents", customer, map[string]any{
		"organizationId": organization["id"], "applicationId": appID, "storeId": expectedStore.String(), "scopes": []string{"messages:send"},
	}, http.StatusCreated)
	authorizationID := created["id"].(string)
	updated := harness.expect("POST", path, storeOwner, map[string]any{
		"organizationId": organization["id"], "applicationId": appID, "storeId": expectedStore.String(), "scopes": []string{"messages:read"},
	}, http.StatusCreated)
	if updated["id"] != authorizationID || len(updated["scopes"].([]any)) != 1 {
		t.Fatalf("authorization update = %v", updated)
	}
	denyStore = true
	status, _ := harness.call("POST", path, outsider, map[string]any{
		"organizationId": organization["id"], "applicationId": appID, "storeId": expectedStore.String(), "scopes": []string{"messages:send"},
	})
	if status != http.StatusForbidden {
		t.Fatalf("unauthorized Commerce membership grant = %d, want 403", status)
	}
	if _, body := harness.call("DELETE", path+"/"+authorizationID, outsider, nil); body["code"] != "BUSINESS_AUTHORIZATION_NOT_FOUND" {
		t.Fatalf("foreign-account revoke response = %v", body)
	}
	harness.execSql(`CREATE FUNCTION reject_business_consent_audit() RETURNS trigger LANGUAGE plpgsql AS $$
		BEGIN
			IF NEW.action = 'revoked' THEN RAISE EXCEPTION 'audit storage unavailable'; END IF;
			RETURN NEW;
		END
	$$`)
	harness.execSql("CREATE TRIGGER reject_business_consent_audit BEFORE INSERT ON developer_business_consent_audit_logs FOR EACH ROW EXECUTE FUNCTION reject_business_consent_audit()")
	if status, _ := harness.call("DELETE", path+"/"+authorizationID, storeOwner, nil); status != http.StatusInternalServerError {
		t.Fatalf("merchant revoke with failed customer-consent audit = %d, want 500", status)
	}
	var grantStatus, consentStatus string
	harness.queryRowWithArgs("SELECT status FROM developer_business_authorizations WHERE id=$1", []any{authorizationID}, &grantStatus)
	harness.queryRowWithArgs("SELECT status FROM developer_business_consents WHERE id=$1", []any{consent["id"]}, &consentStatus)
	if grantStatus != "active" || consentStatus != "active" {
		t.Fatalf("failed audited merchant revocation left grant/consent=%s/%s, want both active", grantStatus, consentStatus)
	}
	harness.execSql("DROP TRIGGER reject_business_consent_audit ON developer_business_consent_audit_logs")
	harness.execSql("DROP FUNCTION reject_business_consent_audit()")
	if status, _ := harness.call("DELETE", path+"/"+authorizationID, storeOwner, nil); status != http.StatusNoContent {
		t.Fatalf("owner revoke = %d, want 204", status)
	}
	consents := harness.expect("GET", "/api/v1/account/business-messaging/consents", customer, nil, http.StatusOK)["consents"].([]any)
	if len(consents) != 1 || consents[0].(map[string]any)["id"] != consent["id"] || consents[0].(map[string]any)["status"] != "revoked" {
		t.Fatalf("merchant revocation did not invalidate customer consent: %v", consents)
	}
	var merchantRevocationAuditCount int
	harness.queryRowWithArgs("SELECT count(*) FROM developer_business_consent_audit_logs WHERE consent_id=$1 AND recipient_account_id=$2 AND actor_account_id=$3 AND action='revoked'", []any{consent["id"], customerAccount, expectedAccount}, &merchantRevocationAuditCount)
	if merchantRevocationAuditCount != 1 {
		t.Fatalf("merchant-caused consent revocation audit count = %d, want 1", merchantRevocationAuditCount)
	}
	denyStore = false
	regranted := harness.expect("POST", path, storeOwner, map[string]any{
		"organizationId": organization["id"], "applicationId": appID, "storeId": expectedStore.String(), "scopes": []string{"messages:send"},
	}, http.StatusCreated)
	if regranted["status"] != "active" {
		t.Fatalf("merchant regrant failed: %v", regranted)
	}
	consents = harness.expect("GET", "/api/v1/account/business-messaging/consents", customer, nil, http.StatusOK)["consents"].([]any)
	if len(consents) != 1 || consents[0].(map[string]any)["status"] != "revoked" {
		t.Fatalf("merchant regrant revived stale customer consent: %v", consents)
	}
	items := harness.expect("GET", path, storeOwner, nil, http.StatusOK)["authorizations"].([]any)
	if len(items) != 1 || items[0].(map[string]any)["status"] != "active" {
		t.Fatalf("regranted authorization missing from owner's current-state view: %v", items)
	}
	var grants, updates, revokes int
	harness.queryRowWithArgs("SELECT count(*) FILTER (WHERE action='granted'), count(*) FILTER (WHERE action='updated'), count(*) FILTER (WHERE action='revoked') FROM developer_business_authorization_audit_logs WHERE actor_account_id=$1 AND store_id=$2", []any{expectedAccount, expectedStore}, &grants, &updates, &revokes)
	if grants != 2 || updates != 1 || revokes != 1 {
		t.Fatalf("grant/update/revoke audit rows = %d/%d/%d", grants, updates, revokes)
	}
}

func TestBusinessApplicationPreviewOnlyReturnsApprovedMessagingAppDetails(t *testing.T) {
	harness := startAuthModuleAgainstFreshSchema(t)
	developer := registerDeveloperTestAccount(t, harness, "business-preview-app-owner@example.com")
	merchant := registerDeveloperTestAccount(t, harness, "business-preview-merchant@example.com")
	organization := harness.expectWithHeaders("POST", "/api/v1/developer/organizations", developer, map[string]string{"name": "Preview Organization", "slug": "preview-organization"}, map[string]string{"Idempotency-Key": uuid.NewString()}, http.StatusCreated)
	app := harness.expectWithHeaders("POST", "/api/v1/developer/organizations/"+organization["id"].(string)+"/applications", developer, map[string]any{
		"name": "Preview App", "purpose": "Connect a merchant-authorized business messaging client.",
		"callbackOrigins": []string{"https://preview.example.com"}, "requestedScopes": []string{"messages:send", "messages:read"},
	}, map[string]string{"Idempotency-Key": uuid.NewString()}, http.StatusCreated)
	path := "/api/v1/account/business-messaging/applications/" + app["id"].(string)
	if status, _ := harness.call("GET", path, merchant, nil); status != http.StatusNotFound {
		t.Fatalf("pending application preview = %d, want 404", status)
	}
	harness.execSql("UPDATE developer_applications SET status='approved' WHERE id=$1", app["id"].(string))
	preview := harness.expect("GET", path, merchant, nil, http.StatusOK)
	if preview["applicationId"] != app["id"] || preview["organizationId"] != organization["id"] || preview["applicationName"] != "Preview App" {
		t.Fatalf("unexpected application preview: %v", preview)
	}
	scopes := preview["requestedScopes"].([]any)
	if len(scopes) != 2 || preview["callbackOrigins"] != nil || preview["status"] != nil {
		t.Fatalf("preview exposed unexpected fields or omitted scopes: %v", preview)
	}
	if status, _ := harness.call("GET", path, "", nil); status != http.StatusUnauthorized {
		t.Fatalf("unauthenticated application preview = %d, want 401", status)
	}
	if status, _ := harness.call("GET", "/api/v1/account/business-messaging/applications/not-an-id", merchant, nil); status != http.StatusNotFound {
		t.Fatalf("invalid application preview = %d, want 404", status)
	}
}

func TestBusinessAuthorizationFailsClosedWithoutCommerceConfiguration(t *testing.T) {
	harness := startAuthModuleAgainstFreshSchema(t)
	developer := registerDeveloperTestAccount(t, harness, "business-auth-missing-owner@example.com")
	organization := harness.expectWithHeaders("POST", "/api/v1/developer/organizations", developer, map[string]string{"name": "No Commerce Org", "slug": "no-commerce-org"}, map[string]string{"Idempotency-Key": uuid.NewString()}, http.StatusCreated)
	app := harness.expectWithHeaders("POST", "/api/v1/developer/organizations/"+organization["id"].(string)+"/applications", developer, map[string]any{
		"name": "Unconfigured App", "purpose": "Confirm owner checks fail closed when Commerce is unavailable.",
		"callbackOrigins": []string{"https://unconfigured.example.com"}, "requestedScopes": []string{"messages:send"},
	}, map[string]string{"Idempotency-Key": uuid.NewString()}, http.StatusCreated)
	harness.execSql("UPDATE developer_applications SET status='approved' WHERE id=$1", app["id"].(string))
	status, body := harness.call("POST", "/api/v1/account/business-messaging/authorizations", developer, map[string]any{
		"organizationId": organization["id"], "applicationId": app["id"], "storeId": uuid.NewString(), "scopes": []string{"messages:send"},
	})
	if status != http.StatusServiceUnavailable || body["code"] != "BUSINESS_AUTHORIZATION_UNAVAILABLE" {
		t.Fatalf("missing Commerce config result = %d %v", status, body)
	}
}
