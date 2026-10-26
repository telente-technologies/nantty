package listsellersettlements

import (
	"context"

	sellermoney "nantty/modules/wallet/src/modules/sellerMoney"
	"nantty/modules/wallet/src/modules/sellerMoney/dtos"
	"nantty/platform/httpserver"
)

type Handler struct {
	Application *sellermoney.Application
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[dtos.SettlementView], error) {
	return handler.Application.Finance.ListSettlements(ctx, query.Seller, query.Cursor, query.Limit)
}
