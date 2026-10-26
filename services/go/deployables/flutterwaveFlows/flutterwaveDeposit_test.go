package flutterwaveflows

import (
	"net/http"
	"testing"
	"time"

	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
)

func TestNigerianUserVerifiesGetsAWalletDepositsAndTheFeeIsSweptThenHeldMoneyIsReleased(t *testing.T) {
	harness := startFlowHarness(t)
	user := harness.newUser("NG")
	harness.verifyToLevelOne(user)
	wallet := harness.Call(http.MethodGet, "/api/v1/payments/wallet/me", harness.Tokens.UserAccessToken(user), "", nil)
	if wallet.Status != http.StatusOK {
		t.Fatalf("wallet view: %d %s", wallet.Status, wallet.Raw)
	}
	harness.deposit(user, 1_000_000)
	harness.runWorkers()
	providerFee, depositFee := int64(5_000), (int64(995_000)*50+9_999)/10_000
	if hold := harness.balance(ledgermodels.WalletDepositHoldAccount(user, "NGN")); hold != 995_000-depositFee {
		t.Fatalf("deposit hold = %d, want %d", hold, 995_000-depositFee)
	}
	if revenue := harness.balance(ledgermodels.PlatformDepositFeeRevenueAccount("NGN")); revenue != depositFee {
		t.Fatalf("swept deposit fee = %d, want %d", revenue, depositFee)
	}
	if main := harness.fake.MainBalanceOf("NGN"); main != depositFee {
		t.Fatalf("fee must reach the main balance: %d", main)
	}
	harness.assertWalletMatchesProvider(user)
	harness.advance(73 * time.Hour)
	harness.runWorkers()
	if available := harness.balance(ledgermodels.WalletAvailableAccount(user, "NGN")); available != 1_000_000-providerFee-depositFee {
		t.Fatalf("available after hold = %d", available)
	}
	harness.AssertLedgerHealthy()
}
