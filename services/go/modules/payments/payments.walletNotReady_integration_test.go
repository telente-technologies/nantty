package payments

import (
	"net/http"
	"testing"

	"github.com/google/uuid"

	paymentstesting "zudomart/modules/payments/src/integrations/paymentsTesting"
)

func TestReadingAWalletThatIsNotProvisionedYetIsOkNotAConflict(t *testing.T) {
	skipIntegrationWhenShort(t)
	harness := paymentstesting.StartMoneyHarnessWithPayments(t, nil)
	user := uuid.NewString()
	read := harness.Call(http.MethodGet, "/api/v1/payments/wallet/me", harness.Tokens.UserAccessToken(user), "", nil)
	if read.Status != http.StatusOK {
		t.Fatalf("an unverified user's wallet read is %d %s, want 200", read.Status, read.Raw)
	}
	if read.Body["wallet"] != nil || read.Body["status"] != "not_ready" {
		t.Fatalf("wallet read body %s, want wallet null and status not_ready", read.Raw)
	}
	if read.Headers.Get("Cache-Control") != "no-store" {
		t.Fatalf("wallet read must not be cached: %q", read.Headers.Get("Cache-Control"))
	}
	activate := harness.Call(http.MethodPost, "/api/v1/payments/wallet/me/activate", harness.Tokens.UserAccessToken(user), "", nil)
	if activate.Status == http.StatusOK {
		t.Fatalf("activation still needs verification, got %d %s", activate.Status, activate.Raw)
	}
}
