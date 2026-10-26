package cancelstocktransfer

import (
	"context"

	"nantty/modules/inventory/src/container"
	"nantty/modules/inventory/src/services"
	"nantty/modules/inventory/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (types.StockTransferView, error) {
	return services.FinishStockTransfer(ctx, handler.Container, services.FinishTransferRequest{
		StoreId: command.Store.StoreId, TransferId: command.TransferId, ActorAccountId: command.ActorAccountId,
		IdempotencyKey: command.IdempotencyKey, Receive: false, Scope: "transfer-cancel:" + command.TransferId.String(),
	})
}
