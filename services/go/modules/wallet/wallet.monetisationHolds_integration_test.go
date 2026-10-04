package wallet

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	payoutservices "zudomart/modules/wallet/src/modules/payouts/services"
)

func TestRestrictedCreatorEarningsStayPendingUntilMonetisationIsRestored(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test: needs Postgres")
	}
	harness := startWalletHarness(t, true)
	creator := uuid.NewString()
	token := harness.Tokens.UserAccessToken(creator)
	harness.creditEarnedCoins(creator, 180)
	if converted := harness.Call(http.MethodPost, "/api/v1/creators/earnings/convert", token, "convert-held-1", map[string]any{"coins": 180, "currency": "NGN"}); converted.Status != http.StatusCreated {
		t.Fatalf("convert: %d %s", converted.Status, converted.Raw)
	}
	harness.OnboardConnectedAccount(creator, false)
	harness.Paystack.FundPlatformBalance("NGN", 175_000)
	holds := harness.wallet.Payouts.Holds
	restrictedAt := time.Now().UTC()
	if err := holds.ApplyAccountHealthChange(context.Background(), payoutservices.AccountHealthChange{AccountId: creator, Status: "RESTRICTED", Restrictions: []string{"MONETISATION", "GOING_LIVE"}, CanMonetise: false, OccurredAt: restrictedAt}); err != nil {
		t.Fatal(err)
	}
	staff := harness.Tokens.StaffTokens(uuid.NewString(), "money.withdrawals.process")
	stepUp := http.Header{"X-Step-Up-Token": {staff.StepUpToken}}
	if report := harness.Call(http.MethodPost, "/api/v1/admin/payouts/run", staff.AccessToken, "", nil, stepUp); report.Body["creatorTransfers"].(float64) != 0 {
		t.Fatalf("a restricted creator's earnings must stay pending: %v", report.Body)
	}
	if harness.balance(ledgermodels.CreatorEarningsPayableAccount(creator, "NGN")) != 180_000 {
		t.Fatal("held earnings stay recorded as payable")
	}
	if err := holds.ApplyAccountHealthChange(context.Background(), payoutservices.AccountHealthChange{AccountId: creator, Status: "AT_RISK", CanMonetise: true, OccurredAt: restrictedAt.Add(-time.Hour)}); err != nil {
		t.Fatal(err)
	}
	if paused, _ := holds.IsMonetisationPaused(context.Background(), harness.Database, creator); !paused {
		t.Fatal("a stale event must not lift the pause")
	}
	if err := holds.ApplyAccountHealthChange(context.Background(), payoutservices.AccountHealthChange{AccountId: creator, Status: "AT_RISK", CanMonetise: true, OccurredAt: restrictedAt.Add(time.Hour)}); err != nil {
		t.Fatal(err)
	}
	if report := harness.Call(http.MethodPost, "/api/v1/admin/payouts/run", staff.AccessToken, "", nil, stepUp); report.Body["creatorTransfers"].(float64) != 1 {
		t.Fatalf("earnings are released once monetisation is restored: %v", report.Body)
	}
}
