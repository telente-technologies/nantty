package listsellersettlements

import (
	"context"

	sellermoney "zudomart/modules/wallet/src/modules/sellerMoney"
	"zudomart/modules/wallet/src/modules/sellerMoney/dtos"
	"zudomart/platform/httpserver"
)

type Handler struct {
	Application *sellermoney.Application
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[dtos.SettlementView], error) {
	return handler.Application.Finance.ListSettlements(ctx, query.Seller, query.Cursor, query.Limit)
}
