package quotewithdrawal

import (
	"context"

	"nantty/modules/wallet/src/modules/payouts"
	"nantty/modules/wallet/src/modules/payouts/dtos"
)

type Handler struct {
	Application *payouts.Application
}

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.WithdrawalQuoteDto, error) {
	quote, _, err := handler.Application.Withdrawals.QuoteWithdrawal(ctx, query.UserId, query.PayoutAccountId, query.AmountMinor, query.Currency)
	return quote, err
}
