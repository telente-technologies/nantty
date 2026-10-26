package convertmoney

import (
	"context"
	"errors"
	"strings"

	"nantty/modules/currency/src/container"
	currencyerrors "nantty/modules/currency/src/errors"
	"nantty/modules/currency/src/modules/exchangeRates/repositories"
	"nantty/modules/currency/src/modules/exchangeRates/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (Result, error) {
	from, to := strings.ToUpper(strings.TrimSpace(query.From)), strings.ToUpper(strings.TrimSpace(query.To))
	fromRate, err := repositories.FindCurrentUsdRateE8(ctx, handler.Container.Client, from)
	if err != nil {
		return Result{}, err
	}
	toRate, err := repositories.FindCurrentUsdRateE8(ctx, handler.Container.Client, to)
	if err != nil {
		return Result{}, err
	}
	converted, err := services.ConvertMinorUnitsWithFloor(query.AmountMinor, fromRate, toRate)
	switch {
	case errors.Is(err, services.ErrInvalidAmount):
		return Result{}, currencyerrors.Unprocessable("INVALID_AMOUNT", err.Error())
	case errors.Is(err, services.ErrAmountOverflow):
		return Result{}, currencyerrors.Unprocessable("AMOUNT_TOO_LARGE", err.Error())
	case err != nil:
		return Result{}, err
	}
	pairRate, err := services.ConvertMinorUnitsWithFloor(100_000_000, fromRate, toRate)
	return Result{AmountMinor: converted, Currency: to, RateE8: pairRate}, err
}
