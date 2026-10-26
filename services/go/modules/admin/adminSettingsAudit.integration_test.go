package admin

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"nantty/modules/admin/src/modules/platformSettings/services"
	"nantty/platform/identityports"
)

func waitForEventTypes(t *testing.T, harness *adminHarness, wanted ...string) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		published := strings.Join(harness.publisher.PublishedEventTypes(), ",")
		missing := false
		for _, eventType := range wanted {
			missing = missing || !strings.Contains(published, eventType)
		}
		if !missing {
			return
		}
		time.Sleep(100 * time.Millisecond)
	}
	t.Fatalf("events not published: want %v, got %v", wanted, harness.publisher.PublishedEventTypes())
}

func (harness *adminHarness) signedInSuperadminWithStepUp(email string) (accessToken string, withStepUp map[string]string) {
	harness.bootstrapSuperadmin(email)
	session, secret := harness.enrollAndSignIn(email, strongPassword)
	accessToken = harness.signInWithMfa(email, strongPassword, secret, 0)["accessToken"].(string)
	_ = session
	return accessToken, bearerWithStepUp(accessToken, harness.grantStepUp(accessToken, secret, 1))
}

func TestSettingsWritesNeedStepUpVersionAndValidValues(t *testing.T) {
	harness := startAdminModuleAgainstFreshSchema(t)
	accessToken, withStepUp := harness.signedInSuperadminWithStepUp("config@zudomart.com")

	listed := harness.expect("GET", "/api/v1/admin/config", nil, bearer(accessToken), http.StatusOK)
	listedKeys := map[string]bool{}
	for _, row := range listed["data"].([]any) {
		listedKeys[row.(map[string]any)["key"].(string)] = true
	}
	expectedKeys := map[string]bool{}
	for key, definition := range services.PlatformSettingDefinitions {
		if definition.Projection == nil {
			expectedKeys[key] = true
		}
	}
	for _, key := range []string{services.StaffSettingsKey, services.CheckmarkSuggestionsKey, services.CreatorThresholdsKey, services.TrialRulesKey, services.CheckmarkPricingKey} {
		expectedKeys[key] = true
	}
	for _, required := range []string{services.SellerDebtLimitsKey, services.PaymentLimitsKey, services.SellerSalesCapKey, services.EscrowPolicyKey} {
		if !listedKeys[required] {
			t.Fatalf("setting %s must be listed: %v", required, listedKeys)
		}
	}
	for key := range expectedKeys {
		if !listedKeys[key] {
			t.Fatalf("every defined setting is listed; %s is missing from %v", key, listedKeys)
		}
	}
	tiers := map[string]any{"tiers": []map[string]any{{"minimumMonthlyGiftCoins": 0, "creatorShareBps": 5500}, {"minimumMonthlyGiftCoins": 1000, "creatorShareBps": 7000}}}
	update := func(value any, version int, reason string) map[string]any {
		return map[string]any{"value": value, "expectedVersion": version, "reason": reason}
	}
	path := "/api/v1/admin/config/gift.shareTiers"
	harness.expect("PUT", path, update(tiers, 1, "raise the tiers"), bearer(accessToken), http.StatusForbidden)
	harness.expect("PUT", path, update(tiers, 1, "no"), withStepUp, http.StatusBadRequest)
	harness.expect("PUT", path, update(map[string]any{"tiers": []map[string]any{{"minimumMonthlyGiftCoins": 0, "creatorShareBps": 7001}}}, 1, "too generous"), withStepUp, http.StatusUnprocessableEntity)
	harness.expect("PUT", path, update(map[string]any{"tiers": []map[string]any{{"minimumMonthlyGiftCoins": 5, "creatorShareBps": 5000}}}, 1, "first not zero"), withStepUp, http.StatusUnprocessableEntity)
	harness.expect("PUT", path, map[string]any{"value": tiers, "expectedVersion": 1, "reason": "unknown field", "force": true}, withStepUp, http.StatusBadRequest)
	harness.expect("PUT", "/api/v1/admin/config/unknown.key", update(tiers, 1, "no such key"), withStepUp, http.StatusNotFound)

	changed := harness.expect("PUT", path, update(tiers, 1, "raise the tiers"), withStepUp, http.StatusOK)
	if changed["version"] != float64(2) {
		t.Fatalf("unexpected %v", changed)
	}
	conflict := harness.expect("PUT", path, update(tiers, 1, "stale write"), withStepUp, http.StatusConflict)
	if conflict["code"] != "VERSION_CONFLICT" {
		t.Fatalf("unexpected %v", conflict)
	}
	fetched := harness.expect("GET", path, nil, bearer(accessToken), http.StatusOK)
	if author, _ := fetched["updatedBy"].(map[string]any); fetched["version"] != float64(2) || author["name"] != "Root" || fetched["changeReason"] != "raise the tiers" {
		t.Fatalf("unexpected %v", fetched)
	}
	waitForEventTypes(t, harness, "platformSetting.changed")

	port, err := identityports.Default.PlatformSettings()
	if err != nil {
		t.Fatal(err)
	}
	value, version, err := port.ReadSettingValue(context.Background(), "gift.shareTiers")
	if err != nil || version != 2 || !bytes.Contains(value, []byte("5500")) {
		t.Fatalf("port read: %s %d %v", value, version, err)
	}
	if _, _, err := port.ReadSettingValue(context.Background(), "nope"); err != identityports.ErrSettingNotFound {
		t.Fatalf("want ErrSettingNotFound, got %v", err)
	}
}

func TestPublicAndInternalSettingReads(t *testing.T) {
	harness := startAdminModuleAgainstFreshSchema(t)
	public := harness.expect("GET", "/api/v1/platform-config/creator-requirements", nil, nil, http.StatusOK)
	if public["key"] != "creator.requirements" || public["version"] != float64(1) {
		t.Fatalf("unexpected %v", public)
	}
	harness.expect("GET", "/api/v1/internal/platform-config/gift.shareTiers", nil, nil, http.StatusUnauthorized)
	harness.expect("GET", "/api/v1/internal/platform-config/gift.shareTiers", nil, map[string]string{"X-Internal-Token": "wrong"}, http.StatusUnauthorized)
	internal := harness.expect("GET", "/api/v1/internal/platform-config/gift.shareTiers", nil, map[string]string{"X-Internal-Token": harness.settings.InternalApiToken}, http.StatusOK)
	if internal["key"] != "gift.shareTiers" {
		t.Fatalf("unexpected %v", internal)
	}
	harness.expect("GET", "/api/v1/internal/platform-config/nope", nil, map[string]string{"X-Internal-Token": harness.settings.InternalApiToken}, http.StatusNotFound)
}

func TestAuditLogIsWrittenSearchableAndExportable(t *testing.T) {
	harness := startAdminModuleAgainstFreshSchema(t)
	accessToken, withStepUp := harness.signedInSuperadminWithStepUp("auditor@zudomart.com")
	harness.expect("PUT", "/api/v1/admin/config/creator.requirements", map[string]any{
		"value":           map[string]any{"minimumFollowers": 50, "minimumAccountAgeDays": 7, "minimumOriginalPosts": 1, "maximumRecentStrikes": 0, "strikeLookbackDays": 30, "requireVerifiedEmail": true},
		"expectedVersion": 1, "reason": "lower the bar for launch",
	}, withStepUp, http.StatusOK)
	recorder, err := identityports.Default.AuditRecorder()
	if err != nil {
		t.Fatal(err)
	}
	if err := recorder.RecordAuditEvent(context.Background(), identityports.AuditEvent{ActorId: "usr-1", Action: "username.withheld", SubjectType: "username", SubjectId: "efcc", Reason: "government name", IpAddress: "203.0.113.9"}); err != nil {
		t.Fatal(err)
	}

	harness.expect("GET", "/api/v1/admin/audit", nil, nil, http.StatusUnauthorized)
	everything := harness.expect("GET", "/api/v1/admin/audit", nil, bearer(accessToken), http.StatusOK)
	if len(everything["data"].([]any)) < 4 {
		t.Fatalf("expected bootstrap, login, mfa, step-up, setting and username events: %v", everything)
	}
	filtered := harness.expect("GET", "/api/v1/admin/audit?action=username.withheld&subjectType=username", nil, bearer(accessToken), http.StatusOK)
	rows := filtered["data"].([]any)
	if len(rows) != 1 || rows[0].(map[string]any)["ipAddress"] != "203.0.113.9" || rows[0].(map[string]any)["reason"] != "government name" {
		t.Fatalf("unexpected filtered rows %v", filtered)
	}
	changed := harness.expect("GET", "/api/v1/admin/audit?action=platform_setting.changed", nil, bearer(accessToken), http.StatusOK)["data"].([]any)
	entry := changed[0].(map[string]any)
	if len(changed) != 1 || entry["before"] == nil || entry["after"] == nil || entry["subjectId"] != "creator.requirements" {
		t.Fatalf("setting change must carry before and after: %v", changed)
	}
	harness.expect("GET", "/api/v1/admin/audit?from=yesterday", nil, bearer(accessToken), http.StatusUnprocessableEntity)
	future := time.Now().Add(time.Hour).UTC().Format(time.RFC3339)
	harness.expect("GET", "/api/v1/admin/audit?from="+future, nil, bearer(accessToken), http.StatusOK)

	page := harness.expect("GET", "/api/v1/admin/audit?actorId=usr-1", nil, bearer(accessToken), http.StatusOK)
	if page["nextCursor"] != nil {
		t.Fatalf("a single row has no next page: %v", page)
	}
	harness.call("GET", "/api/v1/admin/audit/export", nil, bearer(accessToken))
	exported := harness.call("GET", "/api/v1/admin/audit/export?action=username.withheld", nil, withStepUp)
	if exported.status != http.StatusOK || !strings.HasPrefix(exported.headers.Get("Content-Type"), "application/x-ndjson") {
		t.Fatalf("export failed: %d %s", exported.status, exported.raw)
	}
	scanner := bufio.NewScanner(bytes.NewReader(exported.raw))
	lines := 0
	for scanner.Scan() {
		var row map[string]any
		if err := json.Unmarshal(scanner.Bytes(), &row); err != nil || row["action"] != "username.withheld" {
			t.Fatalf("bad ndjson line %q: %v", scanner.Text(), err)
		}
		lines++
	}
	if lines != 1 {
		t.Fatalf("expected one exported row, got %d", lines)
	}
	if status := harness.call("GET", "/api/v1/admin/audit/export", nil, nil).status; status != http.StatusUnauthorized {
		t.Fatalf("export without a session must be refused, got %d", status)
	}
	csvExport := harness.call("GET", "/api/v1/admin/audit/export?format=csv&action=username.withheld", nil, bearer(accessToken))
	if csvExport.status != http.StatusOK || !strings.HasPrefix(csvExport.headers.Get("Content-Type"), "text/csv") || !strings.Contains(string(csvExport.raw), "staffId,actorName") {
		t.Fatalf("csv export failed: %d %s", csvExport.status, csvExport.raw)
	}
	if harness.expect("GET", "/api/v1/admin/audit?action=audit.exported", nil, bearer(accessToken), http.StatusOK)["data"] == nil {
		t.Fatal("exports must be audited")
	}
}

func TestMoneyLimitSettingsNeedStepUpAndAreValidatedOnSave(t *testing.T) {
	harness := startAdminModuleAgainstFreshSchema(t)
	accessToken, withStepUp := harness.signedInSuperadminWithStepUp("limits@zudomart.com")
	path := "/api/v1/admin/config/seller.debtLimits"
	current := harness.expect("GET", path, nil, bearer(accessToken), http.StatusOK)
	raised := map[string]any{"baseMinor": map[string]any{"unverified": 2_000_000, "payoutVerified": 5_000_000, "identityVerified": 20_000_000}, "outsideNigeriaPercent": 50, "trustedSellerAgeDays": 90, "trustedSellerCleanDays": 90, "currencyOverridesMinor": map[string]any{}}
	body := func(value any, reason string) map[string]any {
		return map[string]any{"value": value, "expectedVersion": current["version"], "reason": reason}
	}
	harness.expect("PUT", path, body(raised, "raise the unverified limit"), bearer(accessToken), http.StatusForbidden)
	outOfOrder := map[string]any{"baseMinor": map[string]any{"unverified": 9_000_000, "payoutVerified": 5_000_000, "identityVerified": 20_000_000}, "outsideNigeriaPercent": 50, "trustedSellerAgeDays": 90, "trustedSellerCleanDays": 90, "currencyOverridesMinor": map[string]any{}}
	harness.expect("PUT", path, body(outOfOrder, "levels out of order"), withStepUp, http.StatusUnprocessableEntity)
	saved := harness.expect("PUT", path, body(raised, "raise the unverified limit"), withStepUp, http.StatusOK)
	if saved["version"] != float64(2) {
		t.Fatalf("a valid change with step-up saves a new version: %v", saved)
	}
}
