package confirmorderreceipt

import (
	"context"
	"database/sql"

	"nantty/modules/escrow/src/generated/ent"
	"nantty/modules/escrow/src/generated/ent/escrow"
	"nantty/modules/escrow/src/modules/escrows"
	"nantty/modules/escrow/src/modules/escrows/services"
	"nantty/modules/ledger/src/databases"
)

type Handler struct {
	Application *escrows.Application
}

func (handler Handler) Execute(ctx context.Context, command Command) (*ent.Escrow, error) {
	var result services.EscrowSettlementResult
	err := databases.RunInMoneyTransaction(ctx, handler.Application.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		held, err := handler.Application.Container.Client(transaction).Escrow.Query().Where(escrow.OrderID(command.OrderId)).Only(ctx)
		if ent.IsNotFound(err) || (err == nil && held.BuyerUserID != command.BuyerUserId) {
			return services.ErrEscrowNotFound
		}
		if err != nil {
			return err
		}
		result, err = handler.Application.Escrows.ReleaseEscrowInTransaction(ctx, transaction, command.OrderId, "buyerConfirmed", services.EscrowActor{Type: "buyer", Id: command.BuyerUserId})
		return err
	})
	return result.Escrow, err
}
