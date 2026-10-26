package listsupportedcountries

import (
	"context"

	"nantty/modules/currency/src/constants"
	"nantty/modules/currency/src/container"
	"nantty/modules/currency/src/modules/locale/dtos"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(_ context.Context, _ Query) (Result, error) {
	countries := constants.SupportedCountries()
	views := make([]dtos.CountryView, 0, len(countries))
	for _, country := range countries {
		currency, _ := constants.FindSupportedCurrency(country.Currency)
		views = append(views, dtos.CountryView{CountryCode: country.Code, CountryName: country.Name, Currency: country.Currency, CurrencyName: currency.Name})
	}
	return Result{Data: views}, nil
}
