package wallet_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/google/uuid"

	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	"nantty/modules/wallet/src/modules/payouts/services"
)

func TestASecondCreatorEarningsRunOnTheSameDayMovesNewEarningsButNeverMovesTheSameBalanceTwice(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test: needs Postgres")
	}
	harness := startWalletHarness(t, true)
	creator := uuid.NewString()
	harness.approveCreator(creator)
	token := harness.Tokens.UserAccessToken(creator)
	harness.OnboardConnectedAccount(creator, false)
	harness.approveCreatorProgramMember(creator)
	convert := func(key string, coins int64) {
		harness.post(ledgermodels.JournalEntryRequest{Reference: "seed-earned-" + key, Kind: "test.giftEarnings", Lines: []ledgermodels.JournalLineRequest{
			{Account: ledgermodels.CoinsInCirculationAccount(), Direction: ledgermodels.Debit, AmountMinor: coins},
			{Account: ledgermodels.CreatorEarnedCoinsAccount(creator), Direction: ledgermodels.Credit, AmountMinor: coins},
		}})
		converted := harness.Call(http.MethodPost, "/api/v1/creators/earnings/convert", token, key, map[string]any{"coins": coins, "currency": "NGN"}, http.Header{"CloudFront-Viewer-Country": {"NG"}})
		if converted.Status != http.StatusCreated {
			t.Fatalf("convert: %d %s", converted.Status, converted.Raw)
		}
	}
	ctx := context.Background()
	creators := harness.wallet.Payouts.Creators
	convert("same-day-1", 180)
	if report := creators.TransferCreatorEarningsToConnectedAccounts(ctx, "2026-10-11"); report.Transferred != 1 {
		t.Fatalf("first run: %+v", report)
	}
	creators.TransferCreatorEarningsToConnectedAccounts(ctx, "2026-10-11")
	harness.Flutterwave.FundMainBalance("NGN", 1_000_000)
	harness.RunMoneyWorkers()
	if moved := harness.Flutterwave.WalletBalance(harness.WalletRef(creator), "NGN"); moved != 180_000 {
		t.Fatalf("a repeated run must not move the same balance twice: wallet holds %d", moved)
	}
	if services.CreatorEarningsMoveReference(creator, "NGN", 180_000) != services.CreatorEarningsMoveReference(creator, "NGN", 180_000) ||
		services.CreatorEarningsMoveReference(creator, "NGN", 180_000) == services.CreatorEarningsMoveReference(creator, "NGN", 300_000) {
		t.Fatal("overlapping runs over the same earnings share a reference; new earnings get a new one")
	}
	convert("same-day-2", 120)
	if report := creators.TransferCreatorEarningsToConnectedAccounts(ctx, "2026-10-11"); report.Transferred != 1 || report.Failed != 0 {
		t.Fatalf("a second run on the same day must move the new earnings: %+v", report)
	}
	harness.RunMoneyWorkers()
	if payable, available := harness.balance(ledgermodels.CreatorEarningsPayableAccount(creator, "NGN")), harness.balance(ledgermodels.WalletAvailableAccount(creator, "NGN")); payable != 0 || available != 300_000 {
		t.Fatalf("payable %d, available %d; want 0 and 300,000", payable, available)
	}
	harness.AssertLedgerHealthy()
}
