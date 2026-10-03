package application

import (
	"context"
	"errors"
	"strings"

	"zudomart/modules/currency/internal/rates"
)

type ConvertedMoney struct {
	AmountMinor int64  `json:"amountMinor"`
	Currency    string `json:"currency"`
	RateE8      int64  `json:"rateE8"`
}

func (application *CurrencyApplication) ConvertMoneyBetweenSupportedCurrencies(ctx context.Context, amountMinor int64, from, to string) (ConvertedMoney, error) {
	from, to = strings.ToUpper(strings.TrimSpace(from)), strings.ToUpper(strings.TrimSpace(to))
	fromRate, err := application.CurrentUsdRateE8(ctx, from)
	if err != nil {
		return ConvertedMoney{}, err
	}
	toRate, err := application.CurrentUsdRateE8(ctx, to)
	if err != nil {
		return ConvertedMoney{}, err
	}
	converted, err := rates.ConvertMinorUnitsWithFloor(amountMinor, fromRate, toRate)
	switch {
	case errors.Is(err, rates.ErrInvalidAmount):
		return ConvertedMoney{}, unprocessable("INVALID_AMOUNT", err.Error())
	case errors.Is(err, rates.ErrAmountOverflow):
		return ConvertedMoney{}, unprocessable("AMOUNT_TOO_LARGE", err.Error())
	case err != nil:
		return ConvertedMoney{}, err
	}
	pairRate, err := rates.ConvertMinorUnitsWithFloor(100_000_000, fromRate, toRate)
	return ConvertedMoney{AmountMinor: converted, Currency: to, RateE8: pairRate}, err
}
