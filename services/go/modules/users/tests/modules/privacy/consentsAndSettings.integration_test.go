package privacy

import (
	"nantty/modules/users/src/configs"
	"net/http"
	"testing"
	"time"
)

const testDeviceId = "device-abcdef123456-xyz"

func statusOfConsent(t *testing.T, body map[string]any, consentType string) string {
	t.Helper()
	for _, item := range listItems(t, body) {
		if item["consentType"] == consentType {
			return item["status"].(string)
		}
	}
	t.Fatalf("consent type %s missing from %v", consentType, body)
	return ""
}

func TestPoliciesAndAnonymousConsentLifecycle(t *testing.T) {
	harness := startPrivacyHarness(t)
	policies := listItems(t, harness.expect("GET", "/api/v1/policies/current", "", nil, http.StatusOK))
	if len(policies) != 3 {
		t.Fatalf("privacy, cookie and terms policies must all be published: %v", policies)
	}
	headers := map[string]string{"X-Device-Id": testDeviceId}
	initial := harness.expectWithHeaders("GET", "/api/v1/consents", "", headers, nil, http.StatusOK)
	if statusOfConsent(t, initial, "essential") != "granted" || statusOfConsent(t, initial, "analytics") != "undecided" || initial["policyVersion"] != "1.0" {
		t.Fatalf("a new device has only essential consent: %v", initial)
	}
	harness.expect("GET", "/api/v1/consents", "", nil, http.StatusBadRequest)

	body := map[string]any{"decisions": map[string]bool{"analytics": true, "marketing": false}}
	saved := harness.expectWithHeaders("PUT", "/api/v1/consents", "", headers, body, http.StatusOK)
	if statusOfConsent(t, saved, "analytics") != "granted" || statusOfConsent(t, saved, "marketing") != "withdrawn" || statusOfConsent(t, saved, "advertising") != "undecided" {
		t.Fatalf("unexpected decisions %v", saved)
	}
	harness.expectWithHeaders("PUT", "/api/v1/consents", "", headers, map[string]any{"decisions": map[string]bool{"essential": false, "analytics": true}}, http.StatusBadRequest)
	harness.expectWithHeaders("PUT", "/api/v1/consents", "", headers, map[string]any{"decisions": map[string]bool{"tracking": true}}, http.StatusBadRequest)
	harness.expectWithHeaders("PUT", "/api/v1/consents", "", headers, map[string]any{"decisions": map[string]bool{"analytics": true}, "ipAddress": "1.2.3.4"}, http.StatusBadRequest)
	stale := harness.expectWithHeaders("PUT", "/api/v1/consents", "", headers, map[string]any{"policyVersion": "0.1", "decisions": map[string]bool{"analytics": true}}, http.StatusConflict)
	if stale["code"] != "STALE_POLICY_VERSION" {
		t.Fatalf("unexpected %v", stale)
	}
	rows, _ := harness.container.Client.UserConsent.Query().All(t.Context())
	for _, row := range rows {
		if row.IPAddress == "" || row.AccountID != nil || row.DeviceID == nil || *row.DeviceID != testDeviceId {
			t.Fatalf("server must record ip and device for anonymous consent: %+v", row)
		}
	}
	if len(rows) != 2 {
		t.Fatalf("no-op and rejected writes must not create rows, got %d", len(rows))
	}
}

func TestAnonymousConsentEndpointsAreRateLimitedPerIp(t *testing.T) {
	harness := startPrivacyHarness(t, func(settings *configs.PrivacySettings) { settings.AnonymousConsentPerMinute = 3 })
	headers := map[string]string{"X-Device-Id": testDeviceId}
	for attempt := 1; attempt <= 3; attempt++ {
		harness.expectWithHeaders("GET", "/api/v1/consents", "", headers, nil, http.StatusOK)
	}
	status, body, responseHeaders := harness.send("GET", "/api/v1/consents", "", headers, nil)
	if status != http.StatusTooManyRequests || responseHeaders.Get("Retry-After") == "" || body["code"] != "RATE_LIMITED" {
		t.Fatalf("fourth call must be limited: %d %v", status, body)
	}
}

func TestDeviceConsentMergesOnLoginWithoutOverridingNewerAccountDecisions(t *testing.T) {
	harness := startPrivacyHarness(t)
	_, token := harness.newAccount("merger")
	headers := map[string]string{"X-Device-Id": testDeviceId}
	harness.expectWithHeaders("PUT", "/api/v1/consents", "", headers, map[string]any{"decisions": map[string]bool{"analytics": true, "personalization": true, "marketing": true}}, http.StatusOK)
	harness.clock.advance(time.Minute)
	harness.expect("PUT", "/api/v1/users/me/consents", token, map[string]any{"decisions": map[string]bool{"personalization": false}}, http.StatusOK)

	harness.expect("POST", "/api/v1/users/me/consents/merge", "", map[string]string{"deviceId": testDeviceId}, http.StatusUnauthorized)
	harness.expect("POST", "/api/v1/users/me/consents/merge", token, map[string]string{"deviceId": "short"}, http.StatusBadRequest)
	merged := harness.expect("POST", "/api/v1/users/me/consents/merge", token, map[string]string{"deviceId": testDeviceId}, http.StatusOK)
	if merged["merged"].(float64) != 2 || statusOfConsent(t, merged, "analytics") != "granted" || statusOfConsent(t, merged, "marketing") != "granted" || statusOfConsent(t, merged, "personalization") != "withdrawn" {
		t.Fatalf("device decisions fill gaps, the newer account decision wins: %v", merged)
	}
	again := harness.expect("POST", "/api/v1/users/me/consents/merge", token, map[string]string{"deviceId": testDeviceId}, http.StatusOK)
	if again["merged"].(float64) != 0 {
		t.Fatalf("merge must be idempotent: %v", again)
	}
	settings := harness.expect("GET", "/api/v1/users/me/privacy-settings", token, nil, http.StatusOK)
	if settings["analytics"] != true || settings["marketing"] != true || settings["personalization"] != false || settings["essential"] != true {
		t.Fatalf("settings follow the ledger: %v", settings)
	}
}

func TestPrivacySettingsAreEnforcedFromTheLedgerAndPublishedAsEvents(t *testing.T) {
	harness := startPrivacyHarness(t)
	accountId, token := harness.newAccount("private")
	harness.expect("GET", "/api/v1/users/me/privacy-settings", "", nil, http.StatusUnauthorized)
	defaults := harness.expect("GET", "/api/v1/users/me/privacy-settings", token, nil, http.StatusOK)
	if defaults["personalization"] != false || defaults["personalizedAds"] != false || defaults["marketing"] != false {
		t.Fatalf("everything optional is off until consent is given: %v", defaults)
	}
	harness.expect("PATCH", "/api/v1/users/me/privacy-settings", token, map[string]any{}, http.StatusBadRequest)
	harness.expect("PATCH", "/api/v1/users/me/privacy-settings", token, map[string]any{"marketing": true, "extra": 1}, http.StatusBadRequest)
	harness.expect("PATCH", "/api/v1/users/me/privacy-settings", token, map[string]any{"marketing": true, "policyVersion": "9.9"}, http.StatusConflict)

	on := harness.expect("PATCH", "/api/v1/users/me/privacy-settings", token, map[string]any{"personalization": true, "personalizedAds": true, "marketing": true}, http.StatusOK)
	if on["personalization"] != true || on["personalizedAds"] != true || on["marketing"] != true || on["policyVersion"] != "1.0" {
		t.Fatalf("unexpected %v", on)
	}
	harness.clock.advance(time.Minute)
	off := harness.expect("PATCH", "/api/v1/users/me/privacy-settings", token, map[string]any{"personalizedAds": false, "marketing": false}, http.StatusOK)
	if off["personalization"] != true || off["personalizedAds"] != false || off["marketing"] != false {
		t.Fatalf("withdrawal must be immediate and partial: %v", off)
	}
	harness.expect("PATCH", "/api/v1/users/me/privacy-settings", token, map[string]any{"personalizedAds": false}, http.StatusOK)

	types := harness.outboxEventTypes()
	if countOf(types, "consent.granted") != 3 || countOf(types, "consent.withdrawn") != 2 || countOf(types, "privacy.settingsChanged") != 2 {
		t.Fatalf("events must be emitted once per effective change, got %v", types)
	}
	history := harness.expect("GET", "/api/v1/users/me/consents", token, nil, http.StatusOK)
	if statusOfConsent(t, history, "advertising") != "withdrawn" {
		t.Fatalf("ledger must agree with the settings: %v", history)
	}
	rows, _ := harness.container.Client.UserConsent.Query().All(t.Context())
	if len(rows) != 5 {
		t.Fatalf("past decisions are kept as history, want 5 rows got %d", len(rows))
	}

	internalPath := "/api/v1/internal/users/" + accountId.String() + "/privacy-settings"
	harness.expect("GET", internalPath, "", nil, http.StatusUnauthorized)
	harness.expectWithHeaders("GET", internalPath, "", map[string]string{"X-Internal-Token": "wrong-token"}, nil, http.StatusUnauthorized)
	internal := harness.expectWithHeaders("GET", internalPath, "", map[string]string{"X-Internal-Token": "internal-secret-token-for-tests"}, nil, http.StatusOK)
	if internal["personalization"] != true || internal["marketing"] != false {
		t.Fatalf("unexpected internal view %v", internal)
	}
}

func TestInternalPrivacyEndpointIsHiddenWithoutAToken(t *testing.T) {
	harness := startPrivacyHarness(t, func(settings *configs.PrivacySettings) { settings.InternalApiToken = "" })
	accountId, _ := harness.newAccount("hidden")
	harness.expectWithHeaders("GET", "/api/v1/internal/users/"+accountId.String()+"/privacy-settings", "", map[string]string{"X-Internal-Token": "anything"}, nil, http.StatusNotFound)
}

func TestTermsAcceptanceIsSeparateFromPrivacyConsent(t *testing.T) {
	harness := startPrivacyHarness(t)
	_, token := harness.newAccount("terms")
	harness.expect("POST", "/api/v1/users/me/terms-acceptances", "", map[string]string{"termsVersion": "1.0"}, http.StatusUnauthorized)
	stale := harness.expect("POST", "/api/v1/users/me/terms-acceptances", token, map[string]string{"termsVersion": "0.9"}, http.StatusConflict)
	if stale["code"] != "STALE_POLICY_VERSION" {
		t.Fatalf("unexpected %v", stale)
	}
	first := harness.expect("POST", "/api/v1/users/me/terms-acceptances", token, map[string]string{"termsVersion": "1.0"}, http.StatusCreated)
	harness.clock.advance(time.Minute)
	second := harness.expect("POST", "/api/v1/users/me/terms-acceptances", token, map[string]string{"termsVersion": "1.0"}, http.StatusCreated)
	if first["acceptedAt"] != second["acceptedAt"] {
		t.Fatalf("accepting the same version twice is idempotent: %v %v", first, second)
	}
	if accepted := listItems(t, harness.expect("GET", "/api/v1/users/me/terms-acceptances", token, nil, http.StatusOK)); len(accepted) != 1 {
		t.Fatalf("one acceptance expected: %v", accepted)
	}
	consents := harness.expect("GET", "/api/v1/users/me/consents", token, nil, http.StatusOK)
	if statusOfConsent(t, consents, "analytics") != "undecided" {
		t.Fatalf("terms acceptance must not grant optional consent: %v", consents)
	}
}

func TestStaffPublishesPolicyVersionAndOlderConsentNeedsRenewal(t *testing.T) {
	harness := startPrivacyHarness(t)
	_, token := harness.newAccount("renewal")
	harness.expect("PUT", "/api/v1/users/me/consents", token, map[string]any{"decisions": map[string]bool{"analytics": true}}, http.StatusOK)
	body := map[string]any{"kind": "privacy_policy", "version": "2.0", "effectiveAt": harness.clock.now().Add(time.Hour).UTC().Format(time.RFC3339), "summary": "Adds a new processor", "contentUrl": "https://nantty.com/privacy/2.0"}

	harness.expect("POST", "/api/v1/admin/policy-versions", "", body, http.StatusUnauthorized)
	readOnly, readOnlyStepUp, _ := harness.tokens.SignStaffTokensForTest(t, "admin", []string{"privacy.policies.read"})
	harness.expect("POST", "/api/v1/admin/policy-versions", readOnly, body, http.StatusForbidden)
	writer, writerStepUp, _ := harness.tokens.SignStaffTokensForTest(t, "admin", []string{"privacy.policies.write"})
	missingStepUp := harness.expect("POST", "/api/v1/admin/policy-versions", writer, body, http.StatusForbidden)
	if missingStepUp["code"] != "STEP_UP_REQUIRED" {
		t.Fatalf("unexpected %v", missingStepUp)
	}
	_ = readOnlyStepUp
	headers := map[string]string{"X-Step-Up-Token": writerStepUp}
	harness.expectWithHeaders("POST", "/api/v1/admin/policy-versions", writer, headers, map[string]any{"kind": "terms-of-fun", "version": "2.0", "effectiveAt": body["effectiveAt"]}, http.StatusBadRequest)
	harness.expectWithHeaders("POST", "/api/v1/admin/policy-versions", writer, headers, map[string]any{"kind": "privacy_policy", "version": "1.5", "effectiveAt": "2020-01-01T00:00:00Z"}, http.StatusUnprocessableEntity)
	created := harness.expectWithHeaders("POST", "/api/v1/admin/policy-versions", writer, headers, body, http.StatusCreated)
	if created["version"] != "2.0" {
		t.Fatalf("unexpected %v", created)
	}
	harness.expectWithHeaders("POST", "/api/v1/admin/policy-versions", writer, headers, body, http.StatusUnprocessableEntity)

	if current := harness.expect("GET", "/api/v1/users/me/consents", token, nil, http.StatusOK); current["policyVersion"] != "1.0" || current["needsRenewal"] != false {
		t.Fatalf("a future version is not in force yet: %v", current)
	}
	harness.clock.advance(2 * time.Hour)
	renewal := harness.expect("GET", "/api/v1/users/me/consents", token, nil, http.StatusOK)
	if renewal["policyVersion"] != "2.0" || renewal["needsRenewal"] != true {
		t.Fatalf("consent under the old policy must be renewed: %v", renewal)
	}
	harness.expect("PUT", "/api/v1/users/me/consents", token, map[string]any{"policyVersion": "1.0", "decisions": map[string]bool{"analytics": true}}, http.StatusConflict)
	if countOf(harness.outboxEventTypes(), "policyVersion.published") != 1 || countOf(harness.audit.actions(), "privacy.policy_version_published") != 1 {
		t.Fatalf("publishing must emit an event and an audit record: %v %v", harness.outboxEventTypes(), harness.audit.actions())
	}
}
