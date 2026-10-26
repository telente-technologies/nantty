package getstaffcointransaction

import (
	"context"

	"nantty/modules/wallet/src/modules/coins"
	"nantty/modules/wallet/src/modules/coins/dtos"
)

type Handler struct {
	Application *coins.Application
}

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.CoinTransactionDetailDto, error) {
	return handler.Application.Reviews.GetForStaff(ctx, query.TransactionId)
}
