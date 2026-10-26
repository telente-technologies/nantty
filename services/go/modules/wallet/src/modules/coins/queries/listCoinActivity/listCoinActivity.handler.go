package listcoinactivity

import (
	"context"

	"nantty/modules/wallet/src/modules/coins"
	"nantty/modules/wallet/src/modules/coins/dtos"
	"nantty/platform/httpserver"
)

type Handler struct {
	Application *coins.Application
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[dtos.CoinActivityEntryDto], error) {
	return handler.Application.Balances.ListCoinActivity(ctx, query.UserId, query.AfterLineId, query.Limit)
}
