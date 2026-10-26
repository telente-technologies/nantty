package services

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	"nantty/modules/ledger/src/databases"
	"nantty/modules/ledger/src/modules/journal/models"
)

func TestStaffCanReverseOnlyAllowlistedJournalKinds(t *testing.T) {
	harness := startLedgerAgainstFreshSchema(t)
	harness.mustPost(issueCoinsEntry("issue-allow", "fola", 100))
	moduleOwned := harness.mustPost(spendCoinsEntry("spend-allow", "fola", 40))
	correction := spendCoinsEntry("correct-allow", "fola", 10)
	correction.Kind = "ledger.correction"
	corrected := harness.mustPost(correction)
	reverseAsStaff := func(entry models.PostedJournalEntry) error {
		return databases.RunInMoneyTransaction(context.Background(), harness.database, func(ctx context.Context, transaction *sql.Tx) error {
			_, err := harness.ledger.ReverseJournalEntry(ctx, transaction, ReverseJournalEntryRequest{
				OriginalEntryId: entry.Id, ReversalReference: "admin-reversal:" + entry.Id.String(), Reason: "staff fix", StaffInitiated: true,
			})
			return err
		})
	}
	if err := reverseAsStaff(moduleOwned); !errors.Is(err, models.ErrJournalKindNotStaffReversible) {
		t.Fatalf("staff reversal of a module-owned kind = %v, want refusal", err)
	}
	if got := harness.balance(models.UserSpendableCoinsAccount("fola")); got != 50 {
		t.Fatalf("balance after refused reversal = %d, want 50", got)
	}
	if err := reverseAsStaff(corrected); err != nil {
		t.Fatalf("staff reversal of an allowlisted kind failed: %v", err)
	}
	if got := harness.balance(models.UserSpendableCoinsAccount("fola")); got != 60 {
		t.Fatalf("balance after allowed reversal = %d, want 60", got)
	}
}
