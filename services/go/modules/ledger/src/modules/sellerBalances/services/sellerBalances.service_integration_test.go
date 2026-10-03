package services

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"zudomart/modules/ledger/src/databases"
	moneytesting "zudomart/modules/ledger/src/databases/moneyTesting"
	"zudomart/modules/ledger/src/migrations"
	"zudomart/modules/ledger/src/modules/journal/models"
)

func TestLockedCreditsMatureRefundsDrainLockedThenAvailableThenDebtAndDebtIsRepaidFirst(t *testing.T) {
	database := moneytesting.OpenTestDatabaseOrSkip(t)
	balances := NewSellerBalancesInSchema(moneytesting.CreateFreshSchemaWithMigrations(t, database, "sellers", migrations.Files))
	clock := time.Now()
	balances.Now = func() time.Time { return clock }
	ctx := context.Background()
	run := func(work func(ctx context.Context, transaction *sql.Tx) error) {
		t.Helper()
		if err := databases.RunInMoneyTransaction(ctx, database, work); err != nil {
			t.Fatal(err)
		}
	}
	creditSeller := func(reference string, amount int64) {
		run(func(ctx context.Context, transaction *sql.Tx) error {
			if _, err := balances.Ledger.PostBalancedJournalEntry(ctx, transaction, models.JournalEntryRequest{Reference: reference, Kind: "test.sale", Lines: []models.JournalLineRequest{
				{Account: models.PaymentsAwaitingApplicationAccount("NGN"), Direction: models.Debit, AmountMinor: amount},
				{Account: models.SellerPendingAccount("seller", "NGN"), Direction: models.Credit, AmountMinor: amount},
			}}); err != nil {
				return err
			}
			return balances.ScheduleLockedCreditInTransaction(ctx, transaction, LockedSellerCredit{SellerUserId: "seller", Currency: "NGN", AmountMinor: amount, SourceReference: reference, AvailableAt: clock.Add(24 * time.Hour)})
		})
	}
	refund := func(reference string, amount int64) SellerFundsTaken {
		var taken SellerFundsTaken
		run(func(ctx context.Context, transaction *sql.Tx) error {
			var err error
			taken, err = balances.TakeSellerFundsForRefundInTransaction(ctx, transaction, SellerRefundDebit{
				SellerUserId: "seller", Currency: "NGN", AmountMinor: amount, Reference: reference, Description: "refund",
				CreditAccount: models.RefundsPayableAccount("paystack", "NGN"),
			})
			return err
		})
		return taken
	}
	read := func() SellerBalancesView {
		view, err := balances.ReadSellerBalances(ctx, database, "seller", "NGN")
		if err != nil {
			t.Fatal(err)
		}
		return view
	}

	creditSeller("sale-1", 1_000)
	if view := read(); view.LockedMinor != 1_000 || view.AvailableMinor != 0 || view.NextAvailableAt == nil {
		t.Fatalf("after sale: %+v", view)
	}
	if taken := refund("refund-1", 300); taken.FromPendingMinor != 300 || taken.FromAvailableMinor != 0 || taken.IntoDebtMinor != 0 {
		t.Fatalf("refund from locked: %+v", taken)
	}
	if matured, _ := balances.MatureDueCredits(ctx, database, 10); matured != 0 {
		t.Fatal("credit matured before the hold ended")
	}
	clock = clock.Add(25 * time.Hour)
	if matured, err := balances.MatureDueCredits(ctx, database, 10); err != nil || matured != 1 {
		t.Fatalf("matured %d: %v", matured, err)
	}
	if view := read(); view.AvailableMinor != 700 || view.LockedMinor != 0 {
		t.Fatalf("after maturing: %+v", view)
	}
	if taken := refund("refund-2", 1_000); taken.FromAvailableMinor != 700 || taken.IntoDebtMinor != 300 {
		t.Fatalf("refund after withdrawal-sized drain: %+v", taken)
	}
	creditSeller("sale-2", 500)
	clock = clock.Add(25 * time.Hour)
	if _, err := balances.MatureDueCredits(ctx, database, 10); err != nil {
		t.Fatal(err)
	}
	if view := read(); view.DebtMinor != 0 || view.AvailableMinor != 200 {
		t.Fatalf("debt not repaid first: %+v", view)
	}
	report, err := balances.Ledger.VerifyTrialBalanceAndCachedBalances(ctx, database)
	if err != nil || !report.Healthy() {
		t.Fatalf("ledger unhealthy: %+v %v", report, err)
	}
}
