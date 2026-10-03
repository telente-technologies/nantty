package receivestocktransfer

import (
	"context"

	"zudomart/modules/inventory/src/container"
	"zudomart/modules/inventory/src/services"
	"zudomart/modules/inventory/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (types.StockTransferView, error) {
	return services.FinishStockTransfer(ctx, handler.Container, services.FinishTransferRequest{
		StoreId: command.Store.StoreId, TransferId: command.TransferId, ActorAccountId: command.ActorAccountId,
		IdempotencyKey: command.IdempotencyKey, Receive: true, Scope: "transfer-receive:" + command.TransferId.String(),
	})
}
