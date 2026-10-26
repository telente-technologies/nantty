package listsellertransactions

import (
	"context"

	sellermoney "nantty/modules/wallet/src/modules/sellerMoney"
	"nantty/modules/wallet/src/modules/sellerMoney/dtos"
	"nantty/platform/httpserver"
)

type Handler struct {
	Application *sellermoney.Application
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[dtos.WalletTransactionView], error) {
	return handler.Application.Ledger.ListTransactions(ctx, query.Seller, query.Filter)
}
