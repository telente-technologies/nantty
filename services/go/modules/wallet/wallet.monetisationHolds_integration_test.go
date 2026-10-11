package wallet

import (
	"context"
	"net/http"
	"sync"
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
	harness.OnboardConnectedAccount(creator, false)
	if converted := harness.Call(http.MethodPost, "/api/v1/creators/earnings/convert", token, "convert-held-1", map[string]any{"coins": 180, "currency": "NGN"}, http.Header{"CloudFront-Viewer-Country": {"NG"}}); converted.Status != http.StatusCreated {
		t.Fatalf("convert: %d %s", converted.Status, converted.Raw)
	}
	harness.Paystack.FundPlatformBalance("NGN", 175_000)
	holds := harness.wallet.Payouts.Holds
	restrictedAt := time.Now().UTC()
	if err := holds.ApplyAccountHealthChange(context.Background(), payoutservices.AccountHealthChange{AccountId: creator, Status: "RESTRICTED", Restrictions: []string{"MONETISATION", "GOING_LIVE"}, CanMonetise: false, OccurredAt: restrictedAt}); err != nil {
		t.Fatal(err)
	}
	staff := harness.Tokens.StaffTokens(uuid.NewString(), "money.withdrawals.process")
	stepUp := staff.StepUp
	if report := harness.Call(http.MethodPost, "/api/v1/admin/payouts/run", staff.AccessToken, "", nil, stepUp()); report.Body["creatorTransfers"].(float64) != 0 {
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
	if report := harness.Call(http.MethodPost, "/api/v1/admin/payouts/run", staff.AccessToken, "", nil, stepUp()); report.Body["creatorTransfers"].(float64) != 1 {
		t.Fatalf("earnings are released once monetisation is restored: %v", report.Body)
	}
}

func TestConcurrentHealthEventsSettleOnTheNewestOne(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test: needs Postgres")
	}
	harness := startWalletHarness(t, true)
	holds := harness.wallet.Payouts.Holds
	creator := uuid.NewString()
	newest := time.Now().UTC().Truncate(time.Microsecond)
	var group sync.WaitGroup
	for index := range 40 {
		group.Add(1)
		go func() {
			defer group.Done()
			change := payoutservices.AccountHealthChange{AccountId: creator, Status: "GOOD_STANDING", CanMonetise: true, OccurredAt: newest.Add(-time.Duration(index+1) * time.Minute)}
			if index == 20 {
				change = payoutservices.AccountHealthChange{AccountId: creator, Status: "RESTRICTED", Restrictions: []string{"MONETISATION"}, CanMonetise: false, OccurredAt: newest}
			}
			if err := holds.ApplyAccountHealthChange(context.Background(), change); err != nil {
				t.Error(err)
			}
		}()
	}
	group.Wait()
	if paused, err := holds.IsMonetisationPaused(context.Background(), harness.Database, creator); err != nil || !paused {
		t.Fatalf("the newest restriction must win whatever order the events land in: paused=%v err=%v", paused, err)
	}
}
