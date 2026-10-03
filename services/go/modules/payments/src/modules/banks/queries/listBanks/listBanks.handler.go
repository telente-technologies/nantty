package listbanks

import (
	"context"

	"zudomart/modules/payments/src/interfaces"
	"zudomart/modules/payments/src/modules/gateway"
)

type Handler struct {
	Application *gateway.Application
}

func (handler Handler) Execute(ctx context.Context, query Query) []interfaces.Bank {
	return handler.Application.Banks.ListBanksForCountry(ctx, query.CountryCode)
}
