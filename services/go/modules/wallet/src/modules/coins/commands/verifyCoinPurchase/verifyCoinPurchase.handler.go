package verifycoinpurchase

import (
	"context"

	"zudomart/modules/wallet/src/modules/coins"
	"zudomart/modules/wallet/src/modules/coins/dtos"
)

type Handler struct {
	Application *coins.Application
}

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.VerifiedCoinPurchaseDto, error) {
	return handler.Application.Purchases.VerifyCoinPurchase(ctx, command.UserId, command.Reference)
}
