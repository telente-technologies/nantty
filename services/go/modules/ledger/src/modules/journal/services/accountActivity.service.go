package services

import (
	"context"
	"time"

	"nantty/modules/ledger/src/databases"
	"nantty/modules/ledger/src/generated/ent"
	"nantty/modules/ledger/src/generated/ent/journalentry"
	"nantty/modules/ledger/src/generated/ent/journalline"
	"nantty/modules/ledger/src/generated/ent/ledgeraccount"
	"nantty/modules/ledger/src/modules/journal/models"
)

func (ledger *Ledger) SumLinesOfKindPostedSince(ctx context.Context, executor databases.ExecutorQuerier, account models.AccountRef, direction models.Direction, kind string, since time.Time) (int64, error) {
	var sums []struct {
		Sum *int64 `json:"sum"`
	}
	err := ledger.clientFor(executor).JournalLine.Query().Where(
		journalline.DirectionEQ(journalline.Direction(direction)),
		journalline.HasAccountWith(ledgeraccount.Code(account.Code), ledgeraccount.Currency(account.Currency)),
		journalline.HasEntryWith(journalentry.Kind(kind), journalentry.PostedAtGTE(since)),
	).Aggregate(ent.Sum(journalline.FieldAmountMinor)).Scan(ctx, &sums)
	if err != nil || len(sums) == 0 || sums[0].Sum == nil {
		return 0, err
	}
	return *sums[0].Sum, nil
}
