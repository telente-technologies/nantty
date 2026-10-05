package liststaffcointransactions

import (
	"context"

	"zudomart/modules/wallet/src/modules/coins"
	"zudomart/modules/wallet/src/modules/coins/dtos"
	"zudomart/modules/wallet/src/modules/coins/services"
)

type Handler struct {
	Application *coins.Application
}

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.CoinTransactionListDto, error) {
	return handler.Application.Reviews.ListForStaff(ctx, services.CoinTransactionFilter{
		Kind: query.Kind, ReviewStatus: query.ReviewStatus, Search: query.Search, AfterId: query.AfterId, Limit: query.Limit,
	})
}
