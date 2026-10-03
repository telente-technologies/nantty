package getcoinbalance

import (
	"context"

	"zudomart/modules/wallet/src/modules/coins"
	"zudomart/modules/wallet/src/modules/coins/dtos"
)

type Handler struct {
	Application *coins.Application
}

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.CoinBalanceDto, error) {
	return handler.Application.Balances.ReadCoinBalance(ctx, query.UserId)
}
