package services_test

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"nantty/modules/ledger/src/modules/journal/models"

	"nantty/modules/ledger/src/databases"
	moneytesting "nantty/modules/ledger/src/databases/moneyTesting"
	"nantty/modules/ledger/src/generated/ent"
	"nantty/modules/ledger/src/generated/ent/journalentry"
	"nantty/modules/ledger/src/migrations"
	ledgerservices "nantty/modules/ledger/src/modules/journal/services"
)

type ledgerHarness struct {
	t        *testing.T
	database *sql.DB
	schema   string
	ledger   *ledgerservices.Ledger
}

func startLedgerAgainstFreshSchema(t *testing.T) *ledgerHarness {
	t.Helper()
	database := moneytesting.OpenTestDatabaseOrSkip(t)
	schema := moneytesting.CreateFreshSchemaWithMigrations(t, database, "ledger", migrations.Files)
	return &ledgerHarness{t: t, database: database, schema: schema, ledger: ledgerservices.NewLedgerInSchema(schema)}
}

func (harness *ledgerHarness) client() *ent.Client {
	return ent.NewClient(ent.Driver(databases.EntDriverForExecutor(harness.database)), ent.AlternateSchema(ledgerservices.SchemaConfigForLedgerTables(harness.schema)))
}

func (harness *ledgerHarness) post(request models.JournalEntryRequest) (models.PostedJournalEntry, error) {
	var posted models.PostedJournalEntry
	err := databases.RunInMoneyTransaction(context.Background(), harness.database, func(ctx context.Context, transaction *sql.Tx) error {
		var postError error
		posted, postError = harness.ledger.PostBalancedJournalEntry(ctx, transaction, request)
		return postError
	})
	return posted, err
}

func (harness *ledgerHarness) mustPost(request models.JournalEntryRequest) models.PostedJournalEntry {
	harness.t.Helper()
	posted, err := harness.post(request)
	if err != nil {
		harness.t.Fatalf("post %s: %v", request.Reference, err)
	}
	return posted
}

func (harness *ledgerHarness) balance(account models.AccountRef) int64 {
	harness.t.Helper()
	balance, err := harness.ledger.ReadAccountBalance(context.Background(), harness.database, account)
	if err != nil {
		harness.t.Fatal(err)
	}
	return balance
}

func (harness *ledgerHarness) assertLedgerHealthy() {
	harness.t.Helper()
	report, err := harness.ledger.VerifyTrialBalanceAndCachedBalances(context.Background(), harness.database)
	if err != nil {
		harness.t.Fatal(err)
	}
	if !report.Healthy() {
		harness.t.Fatalf("ledger unhealthy: %+v", report)
	}
}

func issueCoinsEntry(reference, userId string, coins int64) models.JournalEntryRequest {
	return models.JournalEntryRequest{Reference: reference, Kind: "test.coinsIssued", Lines: []models.JournalLineRequest{
		{Account: models.CoinsInCirculationAccount(), Direction: models.Debit, AmountMinor: coins},
		{Account: models.UserSpendableCoinsAccount(userId), Direction: models.Credit, AmountMinor: coins},
	}}
}

func spendCoinsEntry(reference, userId string, coins int64) models.JournalEntryRequest {
	return models.JournalEntryRequest{Reference: reference, Kind: "test.coinsSpent", Lines: []models.JournalLineRequest{
		{Account: models.UserSpendableCoinsAccount(userId), Direction: models.Debit, AmountMinor: coins},
		{Account: models.PlatformGiftRevenueCoinsAccount(), Direction: models.Credit, AmountMinor: coins},
	}}
}

func TestPostingIsIdempotentOnReferenceAndRejectsReuseWithDifferentLines(t *testing.T) {
	harness := startLedgerAgainstFreshSchema(t)
	first := harness.mustPost(issueCoinsEntry("issue-1", "alice", 100))
	replay := harness.mustPost(issueCoinsEntry("issue-1", "alice", 100))
	if !replay.Replayed || replay.Id != first.Id {
		t.Fatalf("expected replay of %s, got %+v", first.Id, replay)
	}
	if got := harness.balance(models.UserSpendableCoinsAccount("alice")); got != 100 {
		t.Fatalf("balance after replay = %d, want 100", got)
	}
	if _, err := harness.post(issueCoinsEntry("issue-1", "alice", 101)); !errors.Is(err, models.ErrJournalReferenceReusedWithDifferentLines) {
		t.Fatalf("expected reuse error, got %v", err)
	}
	if balance, found := first.BalanceAfter(models.UserSpendableCoinsAccount("alice")); !found || balance != 100 {
		t.Fatalf("balance after = %d %v", balance, found)
	}
	harness.assertLedgerHealthy()
}

func TestOverdraftIsRejectedAndLeavesNoTrace(t *testing.T) {
	harness := startLedgerAgainstFreshSchema(t)
	harness.mustPost(issueCoinsEntry("issue-1", "bob", 30))
	_, err := harness.post(spendCoinsEntry("spend-1", "bob", 31))
	var insufficient *models.InsufficientBalanceError
	if !errors.As(err, &insufficient) || insufficient.BalanceMinor != 30 || !errors.Is(err, models.ErrInsufficientBalance) {
		t.Fatalf("expected insufficient balance with balance 30, got %v", err)
	}
	if _, found, _ := harness.ledger.FindJournalEntryByReference(context.Background(), harness.database, "spend-1"); found {
		t.Fatal("a rejected entry was persisted")
	}
	if got := harness.balance(models.UserSpendableCoinsAccount("bob")); got != 30 {
		t.Fatalf("balance = %d, want 30", got)
	}
	harness.assertLedgerHealthy()
}

func TestConcurrentSpendsNeverOverdrawAndSameReferencePostsOnce(t *testing.T) {
	harness := startLedgerAgainstFreshSchema(t)
	harness.mustPost(issueCoinsEntry("issue-1", "carol", 100))
	var succeeded, rejected atomic.Int64
	var group sync.WaitGroup
	for attempt := range 40 {
		group.Add(1)
		go func() {
			defer group.Done()
			_, err := harness.post(spendCoinsEntry(fmt.Sprintf("spend-%d", attempt), "carol", 10))
			switch {
			case err == nil:
				succeeded.Add(1)
			case errors.Is(err, models.ErrInsufficientBalance):
				rejected.Add(1)
			default:
				t.Errorf("unexpected error: %v", err)
			}
		}()
	}
	group.Wait()
	if succeeded.Load() != 10 || rejected.Load() != 30 {
		t.Fatalf("succeeded=%d rejected=%d, want 10/30", succeeded.Load(), rejected.Load())
	}
	if got := harness.balance(models.UserSpendableCoinsAccount("carol")); got != 0 {
		t.Fatalf("balance = %d, want 0", got)
	}
	harness.mustPost(issueCoinsEntry("issue-2", "dave", 50))
	var replays atomic.Int64
	for range 20 {
		group.Add(1)
		go func() {
			defer group.Done()
			posted, err := harness.post(spendCoinsEntry("same-spend", "dave", 20))
			if err != nil {
				t.Errorf("unexpected error: %v", err)
			}
			if posted.Replayed {
				replays.Add(1)
			}
		}()
	}
	group.Wait()
	if replays.Load() != 19 || harness.balance(models.UserSpendableCoinsAccount("dave")) != 30 {
		t.Fatalf("replays=%d balance=%d, want 19 and 30", replays.Load(), harness.balance(models.UserSpendableCoinsAccount("dave")))
	}
	harness.assertLedgerHealthy()
}

func TestReversalRestoresBalancesOnceAndPostedRowsCannotBeMutated(t *testing.T) {
	harness := startLedgerAgainstFreshSchema(t)
	harness.mustPost(issueCoinsEntry("issue-1", "erin", 100))
	spent := harness.mustPost(spendCoinsEntry("spend-1", "erin", 40))
	reverse := func(reference string) (models.PostedJournalEntry, error) {
		var posted models.PostedJournalEntry
		err := databases.RunInMoneyTransaction(context.Background(), harness.database, func(ctx context.Context, transaction *sql.Tx) error {
			var reverseError error
			posted, reverseError = harness.ledger.ReverseJournalEntry(ctx, transaction, ledgerservices.ReverseJournalEntryRequest{OriginalEntryId: spent.Id, ReversalReference: reference, Reason: "test refund"})
			return reverseError
		})
		return posted, err
	}
	reversal, err := reverse("spend-1:reversed")
	if err != nil || reversal.ReversesEntry == nil || *reversal.ReversesEntry != spent.Id {
		t.Fatalf("reversal failed: %+v %v", reversal, err)
	}
	if got := harness.balance(models.UserSpendableCoinsAccount("erin")); got != 100 {
		t.Fatalf("balance after reversal = %d, want 100", got)
	}
	if replay, err := reverse("spend-1:reversed"); err != nil || !replay.Replayed {
		t.Fatalf("expected idempotent replay, got %+v %v", replay, err)
	}
	if _, err := reverse("spend-1:reversed-again"); !errors.Is(err, models.ErrJournalEntryAlreadyReversed) {
		t.Fatalf("expected already reversed, got %v", err)
	}
	client := harness.client()
	if err := client.JournalEntry.Update().Where(journalentry.ID(spent.Id)).Exec(context.Background()); err == nil {
		t.Fatal("posted journal entry was updated")
	}
	if _, err := client.JournalEntry.Delete().Where(journalentry.ID(spent.Id)).Exec(context.Background()); err == nil {
		t.Fatal("posted journal entry was deleted")
	}
	harness.assertLedgerHealthy()
}

func TestStatementListsNewestFirstWithCursor(t *testing.T) {
	harness := startLedgerAgainstFreshSchema(t)
	harness.mustPost(issueCoinsEntry("issue-1", "frank", 100))
	for index := range 5 {
		harness.mustPost(spendCoinsEntry(fmt.Sprintf("spend-%d", index), "frank", 1))
	}
	request := ledgerservices.StatementPageRequest{Accounts: []models.AccountRef{models.UserSpendableCoinsAccount("frank")}, Limit: 4}
	firstPage, cursor, err := harness.ledger.ListStatementLinesNewestFirst(context.Background(), harness.database, request)
	if err != nil || len(firstPage) != 4 || cursor == nil || firstPage[0].BalanceAfterMinor != 95 || firstPage[0].IncreasesBalance {
		t.Fatalf("first page wrong: %+v %v %v", firstPage, cursor, err)
	}
	request.AfterLineId = cursor
	secondPage, cursor, err := harness.ledger.ListStatementLinesNewestFirst(context.Background(), harness.database, request)
	if err != nil || len(secondPage) != 2 || cursor != nil || !secondPage[1].IncreasesBalance || secondPage[1].BalanceAfterMinor != 100 {
		t.Fatalf("second page wrong: %+v %v %v", secondPage, cursor, err)
	}
}

func TestReconciliationClassifiesEveryBreak(t *testing.T) {
	harness := startLedgerAgainstFreshSchema(t)
	collect := func(reference string, amount int64) {
		harness.mustPost(models.JournalEntryRequest{Reference: "collect-" + reference, Kind: "test.collected", ExternalReference: reference, Lines: []models.JournalLineRequest{
			{Account: models.PlatformProviderBalanceAccount("flutterwave", "NGN"), Direction: models.Debit, AmountMinor: amount},
			{Account: models.SellerAvailableAccount("grace", "NGN"), Direction: models.Credit, AmountMinor: amount},
		}})
	}
	collect("ps_matched", 5000)
	collect("ps_wrong_amount", 7000)
	collect("ps_not_at_provider", 1000)
	var report ledgerservices.ReconciliationReport
	err := databases.RunInMoneyTransaction(context.Background(), harness.database, func(ctx context.Context, transaction *sql.Tx) error {
		var reconcileError error
		report, reconcileError = harness.ledger.ReconcileProviderSettlements(ctx, transaction, ledgerservices.ReconcileProviderSettlementsRequest{
			Provider: "flutterwave", WindowStartsAt: time.Now().Add(-time.Hour), WindowEndsAt: time.Now().Add(time.Hour),
			Items: []ledgerservices.ProviderSettlementItem{
				{ProviderReference: "ps_matched", AmountMinor: 5000, Currency: "NGN"},
				{ProviderReference: "ps_wrong_amount", AmountMinor: 6900, Currency: "NGN"},
				{ProviderReference: "ps_missed_webhook", AmountMinor: 2500, Currency: "NGN"},
			},
		})
		return reconcileError
	})
	if err != nil {
		t.Fatal(err)
	}
	kinds := map[string]string{}
	for _, item := range report.Breaks {
		kinds[item.ProviderReference] = item.Kind
	}
	want := map[string]string{"ps_wrong_amount": "amountMismatch", "ps_missed_webhook": "missingInLedger", "ps_not_at_provider": "missingAtProvider"}
	if report.MatchedCount != 1 || len(kinds) != 3 {
		t.Fatalf("report = %+v", report)
	}
	for reference, kind := range want {
		if kinds[reference] != kind {
			t.Errorf("%s: got %s want %s", reference, kinds[reference], kind)
		}
	}
}
