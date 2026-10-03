package getwalletsummary

import (
	"context"

	"zudomart/modules/wallet/src/modules/payouts"
	"zudomart/modules/wallet/src/modules/payouts/dtos"
)

type Handler struct {
	Application *payouts.Application
}

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.WalletSummaryDto, error) {
	return handler.Application.Overview.ReadWalletSummary(ctx, query.UserId, query.Currency)
}
