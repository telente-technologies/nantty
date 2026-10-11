package reversejournalentry

import (
	"context"
	"database/sql"

	"zudomart/modules/ledger/src/container"
	"zudomart/modules/ledger/src/databases"
	"zudomart/modules/ledger/src/modules/journal/models"
	"zudomart/modules/ledger/src/modules/journal/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (models.PostedJournalEntry, error) {
	var reversal models.PostedJournalEntry
	err := databases.RunInMoneyTransaction(ctx, handler.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		var err error
		reversal, err = handler.Container.Ledger.ReverseJournalEntry(ctx, transaction, services.ReverseJournalEntryRequest{
			OriginalEntryId:   command.EntryId,
			ReversalReference: "admin-reversal:" + command.EntryId.String(),
			Reason:            command.Reason,
			Metadata:          map[string]any{"actorStaffId": command.ActorStaffId},
			StaffInitiated:    true,
		})
		return err
	})
	return reversal, services.ConvertLedgerErrorToApiError(err)
}
