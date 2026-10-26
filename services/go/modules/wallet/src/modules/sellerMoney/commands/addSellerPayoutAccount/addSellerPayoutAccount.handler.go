package addsellerpayoutaccount

import (
	"context"

	sellermoney "nantty/modules/wallet/src/modules/sellerMoney"
	"nantty/modules/wallet/src/modules/sellerMoney/dtos"
)

type Handler struct {
	Application *sellermoney.Application
}

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.PayoutAccountView, error) {
	return handler.Application.Accounts.AddFromResolution(ctx, command.Seller, command.ResolutionId)
}
