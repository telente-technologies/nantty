package listbanks

import (
	"context"

	"nantty/modules/payments/src/interfaces"
	"nantty/modules/payments/src/modules/gateway"
)

type Handler struct {
	Application *gateway.Application
}

func (handler Handler) Execute(ctx context.Context, query Query) []interfaces.Bank {
	return handler.Application.Banks.ListBanksForCountry(ctx, query.CountryCode)
}
