package removepayoutaccount

import (
	"context"

	"nantty/modules/wallet/src/modules/payouts"
)

type Handler struct {
	Application *payouts.Application
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	return handler.Application.Accounts.RemovePayoutAccount(ctx, command.UserId, command.PayoutAccountId)
}
