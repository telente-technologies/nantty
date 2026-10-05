package getsellerbalances

import (
	"context"

	sellermoney "zudomart/modules/wallet/src/modules/sellerMoney"
	"zudomart/modules/wallet/src/modules/sellerMoney/dtos"
)

type Handler struct {
	Application *sellermoney.Application
}

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.WalletBalancesView, error) {
	return handler.Application.Ledger.ReadBalances(ctx, query.Seller)
}
