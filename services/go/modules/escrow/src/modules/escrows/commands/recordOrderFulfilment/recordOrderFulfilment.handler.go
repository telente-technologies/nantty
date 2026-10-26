package recordorderfulfilment

import (
	"context"
	"database/sql"

	"nantty/modules/escrow/src/generated/ent"
	"nantty/modules/escrow/src/modules/escrows"
	"nantty/modules/ledger/src/databases"
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
