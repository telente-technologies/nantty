package removesellerpayoutaccount

import (
	"context"

	sellermoney "nantty/modules/wallet/src/modules/sellerMoney"
)

type Handler struct {
	Application *sellermoney.Application
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	return handler.Application.Accounts.Remove(ctx, command.Seller, command.AccountId)
}
