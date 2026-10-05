package listsellerrefunds

import (
	"context"

	sellermoney "zudomart/modules/wallet/src/modules/sellerMoney"
	"zudomart/modules/wallet/src/modules/sellerMoney/dtos"
	"zudomart/platform/httpserver"
)

type Handler struct {
	Application *sellermoney.Application
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[dtos.RefundEntryView], error) {
	return handler.Application.Finance.ListRefunds(ctx, query.Seller, query.Period, query.Text, query.After, query.Limit)
}
