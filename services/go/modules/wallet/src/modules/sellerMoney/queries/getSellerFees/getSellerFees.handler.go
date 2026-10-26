package getsellerfees

import (
	"context"

	sellermoney "nantty/modules/wallet/src/modules/sellerMoney"
	"nantty/modules/wallet/src/modules/sellerMoney/dtos"
)

type Handler struct {
	Application *sellermoney.Application
}

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.FeeBreakdownView, error) {
	return handler.Application.Finance.ReadFees(ctx, query.Seller, query.Period)
}
