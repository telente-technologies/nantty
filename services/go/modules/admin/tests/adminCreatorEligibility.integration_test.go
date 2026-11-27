package admin_test

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"nantty/platform/identityports"
)

func TestCreatorEligibilityIsAViewOfTheCreatorThresholds(t *testing.T) {
	harness := startAdminModuleAgainstFreshSchema(t)
	accessToken, withStepUp := harness.signedInSuperadminWithStepUp("eligibility@nantty.com")
	eligibility := harness.expect("GET", "/api/v1/admin/config/creator-eligibility", nil, bearer(accessToken), http.StatusOK)
	thresholds := harness.expect("GET", "/api/v1/admin/config/creator-thresholds", nil, bearer(accessToken), http.StatusOK)
	if eligibility["key"] != "creator-eligibility" || eligibility["version"] != thresholds["version"] || eligibility["content"].(map[string]any)["minimumFollowers"] != float64(10_000) {
		t.Fatalf("eligibility must mirror the thresholds, got %v / %v", eligibility, thresholds)
	}
	if _, phone := thresholds["content"].(map[string]any)["autoApprove"].(map[string]any)["requiresVerifiedPhone"]; phone {
		t.Fatalf("phone rules are gone: %v", thresholds)
	}
	changed := map[string]any{"minimumFollowers": 20_000, "minimumVerifiedFollowers": 600, "minimumQualifyingImpressionsLast30Days": 120_000, "minimumOriginalPosts": 12, "minimumOriginalPostsInLast60Days": 12, "minimumAccountAgeDays": 45, "noViolationsInDays": 100, "requiresVerifiedEmail": true, "requiresIdentityVerification": true}
	harness.expect("PUT", "/api/v1/admin/config/creator-eligibility", map[string]any{"value": map[string]any{"minimumFollowers": 1, "requiresVerifiedPhone": true}, "expectedVersion": 1, "reason": "old phone field"}, withStepUp, http.StatusUnprocessableEntity)
	updated := harness.expect("PUT", "/api/v1/admin/config/creator-eligibility", map[string]any{"value": changed, "expectedVersion": 1, "reason": "stricter creator entry"}, withStepUp, http.StatusOK)
	if updated["key"] != "creator-eligibility" || updated["version"] != float64(2) || updated["content"].(map[string]any)["minimumAccountAgeDays"] != float64(45) {
		t.Fatalf("unexpected update %v", updated)
	}
	stored := harness.expect("GET", "/api/v1/admin/config/creator-thresholds", nil, bearer(accessToken), http.StatusOK)
	auto := stored["content"].(map[string]any)["autoApprove"].(map[string]any)
	if stored["version"] != float64(2) || auto["minimumRealFollowers"] != float64(20_000) || auto["minimumVerifiedFollowers"] != float64(600) || auto["minimumQualifyingImpressionsLast30Days"] != float64(120_000) || auto["minimumOriginalPostsInLast60Days"] != float64(12) || auto["noViolationsInDays"] != float64(100) || auto["maximumFraudScore"] != float64(30) {
		t.Fatalf("eligibility writes must land in the thresholds, got %v", stored)
	}
	harness.expect("PUT", "/api/v1/admin/config/creator-eligibility", map[string]any{"value": changed, "expectedVersion": 1, "reason": "stale version"}, withStepUp, http.StatusConflict)
	versions := harness.expect("GET", "/api/v1/admin/config/creator-eligibility/versions", nil, bearer(accessToken), http.StatusOK)["data"].([]any)
	if len(versions) != 2 || versions[0].(map[string]any)["content"].(map[string]any)["minimumFollowers"] != float64(20_000) {
		t.Fatalf("unexpected history %v", versions)
	}
	restored := harness.expect("POST", "/api/v1/admin/config/creator-eligibility/versions/1/restore", map[string]any{"expectedVersion": 2, "reason": "back to defaults"}, withStepUp, http.StatusOK)
	if restored["key"] != "creator-eligibility" || restored["content"].(map[string]any)["minimumFollowers"] != float64(10_000) {
		t.Fatalf("unexpected restore %v", restored)
	}
	settings, _ := identityports.Default.PlatformSettings()
	raw, _, err := settings.ReadSettingValue(context.Background(), "creator-eligibility")
	var projected map[string]any
	if err != nil || json.Unmarshal(raw, &projected) != nil || projected["minimumFollowers"] != float64(10_000) {
		t.Fatalf("the in-process port must serve the projection, got %s %v", raw, err)
	}
}
