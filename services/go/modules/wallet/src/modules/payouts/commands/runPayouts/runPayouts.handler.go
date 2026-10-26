package runpayouts

import (
	"context"
	"time"

	"nantty/modules/wallet/src/modules/payouts"
	"nantty/modules/wallet/src/modules/payouts/services"
)

type Handler struct {
	Application *payouts.Application
}

func (handler Handler) Execute(ctx context.Context, command Command) services.PayoutRunReport {
	creators := handler.Application.Creators.TransferCreatorEarningsToConnectedAccounts(ctx, time.Now().UTC().Format("2006-01-02"))
	report := handler.Application.Withdrawals.RunPayoutBatch(ctx, command.Maximum)
	report.CreatorTransfers = creators.Transferred
	return report
}
