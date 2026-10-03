package listwithdrawals

import (
	"context"

	"zudomart/modules/wallet/src/modules/payouts"
	"zudomart/modules/wallet/src/modules/payouts/dtos"
	"zudomart/platform/httpserver"
)

type Handler struct {
	Application *payouts.Application
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[dtos.WithdrawalDto], error) {
	return handler.Application.Overview.ListWithdrawals(ctx, query.UserId, query.Status, query.AfterId, query.Limit)
}
