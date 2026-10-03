package application

import (
	"context"

	"zudomart/modules/currency/internal/catalog"
	"zudomart/modules/currency/internal/ent"
	"zudomart/modules/currency/internal/ent/exchangeraterevision"
)

func (application *CurrencyApplication) SeedDefaultRatesForCurrenciesWithoutRevisions(ctx context.Context) error {
	return application.runInTransaction(ctx, func(tx *ent.Tx) error {
		for _, supported := range catalog.SupportedCurrencies() {
			exists, err := tx.ExchangeRateRevision.Query().Where(exchangeraterevision.Currency(supported.Code)).Exist(ctx)
			if err != nil || exists {
				if err != nil {
					return err
				}
				continue
			}
			err = tx.ExchangeRateRevision.Create().
				SetCurrency(supported.Code).SetUsdRateE8(supported.DefaultE8).SetSource(exchangeraterevision.SourceSeed).SetReason("initial default rate").
				Exec(ctx)
			if err != nil {
				return err
			}
		}
		return nil
	})
}
