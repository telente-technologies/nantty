package requestsellerpayout

import (
	"context"

	sellermoney "nantty/modules/wallet/src/modules/sellerMoney"
	"nantty/modules/wallet/src/modules/sellerMoney/dtos"
)

type Handler struct {
	Application *sellermoney.Application
}

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.PayoutView, bool, error) {
	return handler.Application.Sellers.RequestPayout(ctx, command.Seller, command.Body, command.IdempotencyKey)
}
