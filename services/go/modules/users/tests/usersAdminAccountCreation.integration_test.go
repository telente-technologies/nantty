package users_test

import (
	"net/http"
	"testing"
)

func TestOnlyStaffWhoCanGrantCheckmarksMayCreateAccounts(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	body := map[string]any{"username": "brand.official", "displayName": "Brand Official", "email": "brand.official@example.com", "password": "Strong-Pass-2026", "country": "NG", "profileType": "business", "reason": "official brand onboarding"}
	supportToken, supportStepUp := harness.staffHeaders("users:read", "support:tickets")
	harness.expect("POST", "/api/v1/admin/accounts", supportToken, body, http.StatusForbidden, supportStepUp...)
}
