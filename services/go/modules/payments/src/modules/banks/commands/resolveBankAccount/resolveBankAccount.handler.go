package resolvebankaccount

import (
	"context"
	"errors"
	"net/http"

	"nantty/modules/payments/src/interfaces"
	bankservices "nantty/modules/payments/src/modules/banks/services"
	"nantty/modules/payments/src/modules/gateway"
	"nantty/modules/payments/src/modules/gateway/services"
	"nantty/platform/httpserver"
)

var (
	ErrUnknownBank         = httpserver.NewApiError(http.StatusUnprocessableEntity, "UNKNOWN_BANK", "Choose your bank.")
	ErrBankAccountNotFound = httpserver.NewApiError(http.StatusNotFound, "ACCOUNT_NOT_FOUND", "We could not find that account. Check the number and bank.")
)

type Handler struct {
	Application *gateway.Application
}

func (handler Handler) Execute(ctx context.Context, command Command) (string, error) {
	banks := handler.Application.Banks.ListBanksForCountry(ctx, command.CountryCode)
	if _, known := bankservices.IsBankKnownInCountry(banks, command.BankCode); !known {
		return "", ErrUnknownBank
	}
	accountName, err := handler.Application.Banks.ResolveAccountName(ctx, command.BankCode, command.AccountNumber)
	switch {
	case errors.Is(err, interfaces.ErrBankAccountNotFound):
		return "", ErrBankAccountNotFound
	case err != nil:
		return "", services.ErrProviderUnavailable
	}
	return accountName, nil
}
