package listpayoutaccounts

import (
	"context"

	"nantty/modules/wallet/src/modules/payouts"
	"nantty/modules/wallet/src/modules/payouts/dtos"
)

type Handler struct {
	Application *payouts.Application
}

func (handler Handler) Execute(ctx context.Context, query Query) ([]dtos.PayoutAccountDto, error) {
	return handler.Application.Accounts.ListPayoutAccounts(ctx, query.UserId)
}
