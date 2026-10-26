package listsellerstatements

import (
	"context"

	sellermoney "nantty/modules/wallet/src/modules/sellerMoney"
	"nantty/modules/wallet/src/modules/sellerMoney/dtos"
)

type Handler struct {
	Application *sellermoney.Application
}

func (handler Handler) Execute(ctx context.Context, query Query) ([]dtos.StatementMonthView, error) {
	return handler.Application.Ledger.ListMonthlyStatements(ctx, query.Seller, handler.Application.Payouts.Container.Now())
}
