package listwithdrawals

import (
	"context"

	"nantty/modules/wallet/src/modules/payouts"
	"nantty/modules/wallet/src/modules/payouts/dtos"
	"nantty/platform/httpserver"
)

type Handler struct {
	Application *payouts.Application
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[dtos.WithdrawalDto], error) {
	return handler.Application.Overview.ListWithdrawals(ctx, query.UserId, query.Status, query.AfterId, query.Limit)
}
