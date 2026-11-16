package services_test

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"

	"nantty/modules/ledger/src/databases"
	"nantty/modules/ledger/src/generated/ent/ledgeraccount"
	"nantty/modules/ledger/src/modules/journal/models"
)

func giftEntry(reference, sender string, coins int64) models.JournalEntryRequest {
	return models.JournalEntryRequest{Reference: reference, Kind: "test.gift", Lines: []models.JournalLineRequest{
		{Account: models.UserSpendableCoinsAccount(sender), Direction: models.Debit, AmountMinor: coins},
		{Account: models.PlatformGiftRevenueCoinsAccount(), Direction: models.Credit, AmountMinor: coins},
	}}
}

func (harness *ledgerHarness) seedCoins(userId string, coins int64) {
	harness.mustPost(models.JournalEntryRequest{Reference: "seed-coins-" + userId, Kind: "test.seed", Lines: []models.JournalLineRequest{
		{Account: models.CoinsInCirculationAccount(), Direction: models.Debit, AmountMinor: coins},
		{Account: models.UserSpendableCoinsAccount(userId), Direction: models.Credit, AmountMinor: coins},
	}})
}

func referencesOnDifferentStripes() (string, string) {
	first := "gift-stripe-a"
	firstCode := models.PlatformAccountStripeForReference(models.PlatformGiftRevenueCoinsAccount(), first).Code
	for attempt := 0; ; attempt++ {
		candidate := fmt.Sprintf("gift-stripe-b-%d", attempt)
		if models.PlatformAccountStripeForReference(models.PlatformGiftRevenueCoinsAccount(), candidate).Code != firstCode {
			return first, candidate
		}
	}
}

func TestAnOpenGiftOnOnePlatformStripeDoesNotBlockAGiftOnAnother(t *testing.T) {
	harness := startLedgerAgainstFreshSchema(t)
	harness.seedCoins("sender-a", 100)
	harness.seedCoins("sender-b", 100)
	firstReference, secondReference := referencesOnDifferentStripes()
	firstHoldsItsLocks := make(chan struct{})
	releaseFirst := make(chan struct{})
	var firstError error
	var group sync.WaitGroup
	group.Add(1)
	go func() {
		defer group.Done()
		firstError = databases.RunInMoneyTransaction(context.Background(), harness.database, func(ctx context.Context, transaction *sql.Tx) error {
			if _, err := harness.ledger.PostBalancedJournalEntry(ctx, transaction, giftEntry(firstReference, "sender-a", 10)); err != nil {
				return err
			}
			close(firstHoldsItsLocks)
			<-releaseFirst
			return nil
		})
	}()
	<-firstHoldsItsLocks
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	secondError := databases.RunInMoneyTransaction(ctx, harness.database, func(ctx context.Context, transaction *sql.Tx) error {
		_, err := harness.ledger.PostBalancedJournalEntry(ctx, transaction, giftEntry(secondReference, "sender-b", 10))
		return err
	})
	close(releaseFirst)
	group.Wait()
	if secondError != nil || firstError != nil {
		t.Fatalf("a gift waited on another gift's platform row: first %v second %v", firstError, secondError)
	}
	if harness.balance(models.PlatformGiftRevenueCoinsAccount()) != 20 {
		t.Fatalf("platform revenue across stripes = %d", harness.balance(models.PlatformGiftRevenueCoinsAccount()))
	}
}

func TestConcurrentGiftsSpreadOverPlatformStripesAndTheLedgerStaysBalanced(t *testing.T) {
	harness := startLedgerAgainstFreshSchema(t)
	const senders = 24
	for index := range senders {
		harness.seedCoins(fmt.Sprintf("sender-%02d", index), 50)
	}
	var group sync.WaitGroup
	failures := make(chan error, senders*3)
	for index := range senders {
		for gift := range 3 {
			group.Add(1)
			go func() {
				defer group.Done()
				if _, err := harness.post(giftEntry(fmt.Sprintf("gift-%02d-%d", index, gift), fmt.Sprintf("sender-%02d", index), 10)); err != nil {
					failures <- err
				}
			}()
		}
	}
	group.Wait()
	close(failures)
	for err := range failures {
		t.Fatalf("concurrent gift failed: %v", err)
	}
	if total := harness.balance(models.PlatformGiftRevenueCoinsAccount()); total != senders*3*10 {
		t.Fatalf("platform revenue = %d", total)
	}
	stripes, err := harness.client().LedgerAccount.Query().
		Where(ledgeraccount.CodeHasPrefix(models.PlatformGiftRevenueCoinsAccount().Code + ":stripe:")).Count(context.Background())
	if err != nil || stripes < 4 {
		t.Fatalf("gifts used %d platform stripes: %v", stripes, err)
	}
	report, err := harness.ledger.VerifyTrialBalanceAndCachedBalances(context.Background(), harness.database)
	if err != nil || !report.Healthy() {
		t.Fatalf("integrity %+v %v", report, err)
	}
}

func TestPostedJournalRowsCannotBeUpdatedOrDeletedAtTheDatabase(t *testing.T) {
	harness := startLedgerAgainstFreshSchema(t)
	harness.seedCoins("immutable", 10)
	schema := harness.schema
	for _, statement := range []string{
		`UPDATE "` + schema + `".journal_entries SET description = 'edited'`,
		`DELETE FROM "` + schema + `".journal_lines`,
		`DELETE FROM "` + schema + `".journal_entries`,
	} {
		_, err := harness.database.Exec(statement)
		if err == nil || !strings.Contains(err.Error(), "append-only") {
			t.Fatalf("%s: expected the append-only trigger to refuse, got %v", statement, err)
		}
	}
}
