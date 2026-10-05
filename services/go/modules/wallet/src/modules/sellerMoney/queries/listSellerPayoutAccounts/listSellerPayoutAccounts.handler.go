package listsellerpayoutaccounts

import (
	"context"

	sellermoney "zudomart/modules/wallet/src/modules/sellerMoney"
	"zudomart/modules/wallet/src/modules/sellerMoney/dtos"
)

type Handler struct {
	Application *sellermoney.Application
}

func (handler Handler) Execute(ctx context.Context, query Query) ([]dtos.PayoutAccountView, error) {
	return handler.Application.Accounts.List(ctx, query.Seller)
}
