package setdefaultsellerpayoutaccount

import (
	"context"

	sellermoney "zudomart/modules/wallet/src/modules/sellerMoney"
	"zudomart/modules/wallet/src/modules/sellerMoney/dtos"
)

type Handler struct {
	Application *sellermoney.Application
}

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.PayoutAccountView, error) {
	return handler.Application.Accounts.MakeDefault(ctx, command.Seller, command.AccountId)
}
