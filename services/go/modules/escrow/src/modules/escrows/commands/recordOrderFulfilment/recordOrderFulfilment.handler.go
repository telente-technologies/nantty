package recordorderfulfilment

import (
	"context"
	"database/sql"

	"zudomart/modules/escrow/src/generated/ent"
	"zudomart/modules/escrow/src/modules/escrows"
	"zudomart/modules/ledger/src/databases"
)

type Handler struct {
	Application *escrows.Application
}

func (handler Handler) Execute(ctx context.Context, command Command) (*ent.Escrow, error) {
	var updated *ent.Escrow
	err := databases.RunInMoneyTransaction(ctx, handler.Application.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		var err error
		updated, err = handler.Application.Escrows.RecordOrderFulfilmentInTransaction(ctx, transaction, command.Fulfilment)
		return err
	})
	return updated, err
}
