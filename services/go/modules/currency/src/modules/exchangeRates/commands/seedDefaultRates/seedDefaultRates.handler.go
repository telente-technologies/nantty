package seeddefaultrates

import (
	"context"

	"nantty/modules/currency/src/constants"
	"nantty/modules/currency/src/container"
	"nantty/modules/currency/src/generated/ent"
	"nantty/modules/currency/src/generated/ent/exchangeraterevision"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, _ Command) error {
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		for _, supported := range constants.SupportedCurrencies() {
			exists, err := tx.ExchangeRateRevision.Query().Where(exchangeraterevision.Currency(supported.Code)).Exist(ctx)
			if err != nil {
				return err
			}
			if exists {
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
