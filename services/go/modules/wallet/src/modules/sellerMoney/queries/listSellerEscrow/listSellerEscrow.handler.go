package listsellerescrow

import (
	"context"

	sellermoney "nantty/modules/wallet/src/modules/sellerMoney"
	"nantty/modules/wallet/src/modules/sellerMoney/dtos"
)

type Handler struct {
	Application *sellermoney.Application
}

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.EscrowEntriesPage, error) {
	return handler.Application.Finance.ListEscrow(ctx, query.Seller, query.Status, query.Text, query.After, query.Limit)
}
