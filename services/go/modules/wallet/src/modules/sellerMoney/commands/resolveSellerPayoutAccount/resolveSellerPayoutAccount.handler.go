package resolvesellerpayoutaccount

import (
	"context"

	sellermoney "nantty/modules/wallet/src/modules/sellerMoney"
	"nantty/modules/wallet/src/modules/sellerMoney/dtos"
)

type Handler struct {
	Application *sellermoney.Application
}

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.ResolvedPayoutAccountView, error) {
	return handler.Application.Accounts.Resolve(ctx, command.Seller, command.Body)
}
