package resolvebankaccount

import (
	"context"
	"errors"
	"net/http"

	"zudomart/modules/payments/src/interfaces"
	bankservices "zudomart/modules/payments/src/modules/banks/services"
	"zudomart/modules/payments/src/modules/gateway"
	"zudomart/modules/payments/src/modules/gateway/services"
	"zudomart/platform/httpserver"
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
