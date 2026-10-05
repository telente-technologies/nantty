package getstaffwithdrawal

import (
	"context"

	"zudomart/modules/wallet/src/modules/payouts"
	"zudomart/modules/wallet/src/modules/payouts/dtos"
)

type Handler struct {
	Application *payouts.Application
}

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.StaffWithdrawalDetailDto, error) {
	return handler.Application.Withdrawals.GetWithdrawalForStaff(ctx, query.WithdrawalId)
}
