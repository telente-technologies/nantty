package getsellerstatement

import (
	"context"

	sellermoney "zudomart/modules/wallet/src/modules/sellerMoney"
	"zudomart/modules/wallet/src/modules/sellerMoney/dtos"
)

type Handler struct {
	Application *sellermoney.Application
}

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.StatementDetailView, error) {
	return handler.Application.Ledger.ReadMonthStatement(ctx, query.Seller, query.Month, handler.Application.Payouts.Container.Now())
}
