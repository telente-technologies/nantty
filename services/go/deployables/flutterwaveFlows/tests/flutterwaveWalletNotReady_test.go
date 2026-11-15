package flutterwaveflows

import (
	"net/http"
	"testing"
)

func TestReadingTheWalletBeforeVerificationIsNotAConflict(t *testing.T) {
	harness := startFlowHarness(t)
	user := harness.newUser("NG")
	before := harness.Call(http.MethodGet, "/api/v1/payments/wallet/me", harness.Tokens.UserAccessToken(user), "", nil)
	if before.Status != http.StatusOK {
		t.Fatalf("unverified wallet read: %d %s, want 200", before.Status, before.Raw)
	}
	if before.Body["wallet"] != nil || before.Body["status"] != "not_ready" {
		t.Fatalf("unverified wallet read body: %s, want wallet null and status not_ready", before.Raw)
	}
	harness.verifyToLevelOne(user)
	after := harness.Call(http.MethodGet, "/api/v1/payments/wallet/me", harness.Tokens.UserAccessToken(user), "", nil)
	if after.Status != http.StatusOK || after.Body["wallet"] == nil {
		t.Fatalf("verified wallet read: %d %s, want the wallet", after.Status, after.Raw)
	}
}
