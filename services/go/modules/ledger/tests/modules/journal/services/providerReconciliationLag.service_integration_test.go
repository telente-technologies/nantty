package services

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"nantty/modules/ledger/src/databases"
	"nantty/modules/ledger/src/modules/journal/models"
)

func TestReconciliationMatchesByReferenceWhateverThePostedDate(t *testing.T) {
	harness := startLedgerAgainstFreshSchema(t)
	harness.mustPost(models.JournalEntryRequest{Reference: "collect-late", Kind: "test.collected", ExternalReference: "ps_settled_late", Lines: []models.JournalLineRequest{
		{Account: models.PlatformProviderBalanceAccount("flutterwave", "NGN"), Direction: models.Debit, AmountMinor: 4000},
		{Account: models.SellerAvailableAccount("hana", "NGN"), Direction: models.Credit, AmountMinor: 4000},
	}})
	harness.mustPost(models.JournalEntryRequest{Reference: "collect-fresh", Kind: "test.collected", ExternalReference: "ps_not_settled_yet", Lines: []models.JournalLineRequest{
		{Account: models.PlatformProviderBalanceAccount("flutterwave", "NGN"), Direction: models.Debit, AmountMinor: 900},
		{Account: models.SellerAvailableAccount("hana", "NGN"), Direction: models.Credit, AmountMinor: 900},
	}})
	run := func(request ReconcileProviderSettlementsRequest) ReconciliationReport {
		var report ReconciliationReport
		err := databases.RunInMoneyTransaction(context.Background(), harness.database, func(ctx context.Context, transaction *sql.Tx) error {
			var err error
			report, err = harness.ledger.ReconcileProviderSettlements(ctx, transaction, request)
			return err
		})
		if err != nil {
			t.Fatal(err)
		}
		return report
	}
	oldWindow := run(ReconcileProviderSettlementsRequest{Provider: "flutterwave", WindowStartsAt: time.Now().Add(-10 * 24 * time.Hour), WindowEndsAt: time.Now().Add(-9 * 24 * time.Hour),
		Items: []ProviderSettlementItem{{ProviderReference: "ps_settled_late", AmountMinor: 4000, Currency: "NGN"}}})
	if oldWindow.MatchedCount != 1 || len(oldWindow.Breaks) != 0 {
		t.Fatalf("a settlement reported outside the posting window must still match: %+v", oldWindow)
	}
	current := run(ReconcileProviderSettlementsRequest{Provider: "flutterwave", WindowStartsAt: time.Now().Add(-time.Hour), WindowEndsAt: time.Now().Add(time.Hour), SettlementGrace: 72 * time.Hour,
		Items: []ProviderSettlementItem{{ProviderReference: "ps_settled_late", AmountMinor: 4000, Currency: "NGN"}}})
	if current.MatchedCount != 1 || current.AwaitingSettlement != 1 || len(current.Breaks) != 0 {
		t.Fatalf("a fresh collection inside the settlement grace is not a break: %+v", current)
	}
}
