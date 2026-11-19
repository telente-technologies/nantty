package addpayoutaccount

import (
	"context"

	"nantty/modules/wallet/src/modules/payouts"
	"nantty/modules/wallet/src/modules/payouts/dtos"
)

type Handler struct {
	Application *payouts.Application
}

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.PayoutAccountDto, error) {
	return handler.Application.Accounts.AddPayoutAccount(ctx, command.UserId, command.CountryCode, command.BankCode, command.AccountNumber, command.BranchCode)
}
