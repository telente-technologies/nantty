package listsellerescrow

import (
	"context"

	sellermoney "zudomart/modules/wallet/src/modules/sellerMoney"
	"zudomart/modules/wallet/src/modules/sellerMoney/dtos"
)

type Handler struct {
	Application *sellermoney.Application
}

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.EscrowEntriesPage, error) {
	return handler.Application.Finance.ListEscrow(ctx, query.Seller, query.Status, query.Text, query.After, query.Limit)
}
