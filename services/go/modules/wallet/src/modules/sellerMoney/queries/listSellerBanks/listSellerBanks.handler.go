package listsellerbanks

import (
	"context"

	sellermoney "zudomart/modules/wallet/src/modules/sellerMoney"
	"zudomart/modules/wallet/src/modules/sellerMoney/dtos"
)

type Handler struct {
	Application *sellermoney.Application
}

func (handler Handler) Execute(ctx context.Context, query Query) []dtos.BankView {
	return handler.Application.Accounts.ListBanks(ctx, query.Seller)
}
