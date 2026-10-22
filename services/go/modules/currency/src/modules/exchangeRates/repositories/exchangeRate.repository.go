package repositories

import (
	"context"

	"zudomart/modules/currency/src/constants"
	currencyerrors "zudomart/modules/currency/src/errors"
	"zudomart/modules/currency/src/generated/ent"
	"zudomart/modules/currency/src/generated/ent/exchangeraterevision"
)

func FindLatestRevisionForCurrency(ctx context.Context, client *ent.Client, code string) (*ent.ExchangeRateRevision, error) {
	return client.ExchangeRateRevision.Query().Where(exchangeraterevision.Currency(code)).Order(ent.Desc(exchangeraterevision.FieldCreatedAt), ent.Desc(exchangeraterevision.FieldID)).First(ctx)
}

func FindCurrentUsdRateE8(ctx context.Context, client *ent.Client, code string) (int64, error) {
	if _, supported := constants.FindSupportedCurrency(code); !supported {
		return 0, currencyerrors.UnsupportedCurrency
	}
	latest, err := FindLatestRevisionForCurrency(ctx, client, code)
	if ent.IsNotFound(err) {
		return 0, currencyerrors.RateUnavailable
	}
	if err != nil {
		return 0, err
	}
	return latest.UsdRateE8, nil
}
