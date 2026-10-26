package listsupportedcurrencies

import (
	"context"
	"time"

	"nantty/modules/currency/src/constants"
	"nantty/modules/currency/src/container"
	"nantty/modules/currency/src/modules/exchangeRates/models"
	"nantty/modules/currency/src/modules/exchangeRates/repositories"
	"nantty/modules/currency/src/modules/exchangeRates/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, _ Query) (Result, error) {
	supported := constants.SupportedCurrencies()
	views := make([]models.CurrencyView, 0, len(supported))
	for _, currency := range supported {
		latest, err := repositories.FindLatestRevisionForCurrency(ctx, handler.Container.Client, currency.Code)
		if err != nil {
			return Result{}, err
		}
		views = append(views, models.CurrencyView{
			Code: currency.Code, Name: currency.Name, MinorUnits: currency.MinorUnits, UsdRateE8: latest.UsdRateE8,
			Rate: services.FormatE8AsDecimal(latest.UsdRateE8), UpdatedAt: latest.CreatedAt.UTC().Format(time.RFC3339),
		})
	}
	return Result{Data: views}, nil
}
