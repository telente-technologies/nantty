package getsellerstatement

import (
	"context"

	sellermoney "nantty/modules/wallet/src/modules/sellerMoney"
	"nantty/modules/wallet/src/modules/sellerMoney/dtos"
)

type Handler struct {
	Application *sellermoney.Application
}

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.StatementDetailView, error) {
	return handler.Application.Ledger.ReadMonthStatement(ctx, query.Seller, query.Month, handler.Application.Payouts.Container.Now())
}
