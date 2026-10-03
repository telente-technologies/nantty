package runpayouts

import (
	"context"

	"zudomart/modules/wallet/src/modules/payouts"
	"zudomart/modules/wallet/src/modules/payouts/services"
)

type Handler struct {
	Application *payouts.Application
}

func (handler Handler) Execute(ctx context.Context, command Command) services.PayoutRunReport {
	return handler.Application.Withdrawals.RunPayoutBatch(ctx, command.Maximum)
}
