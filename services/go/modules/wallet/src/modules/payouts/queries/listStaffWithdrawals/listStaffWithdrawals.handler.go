package liststaffwithdrawals

import (
	"context"

	"nantty/modules/wallet/src/modules/payouts"
	"nantty/modules/wallet/src/modules/payouts/dtos"
	"nantty/modules/wallet/src/modules/payouts/services"
)

type Handler struct {
	Application *payouts.Application
}

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.StaffWithdrawalListDto, error) {
	return handler.Application.Withdrawals.ListWithdrawalsForStaff(ctx, services.StaffWithdrawalFilter{Status: query.Status, Search: query.Search, AfterId: query.AfterId, Limit: query.Limit})
}
