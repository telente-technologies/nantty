package listwallettransactions

import (
	"context"

	"zudomart/modules/wallet/src/modules/payouts"
	"zudomart/modules/wallet/src/modules/payouts/dtos"
	"zudomart/platform/httpserver"
)

type Handler struct {
	Application *payouts.Application
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[dtos.WalletTransactionDto], error) {
	return handler.Application.Overview.ListWalletTransactions(ctx, query.UserId, query.Currency, query.AfterLineId, query.Limit)
}
