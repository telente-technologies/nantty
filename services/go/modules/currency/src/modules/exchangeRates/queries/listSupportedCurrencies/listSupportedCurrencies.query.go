package listsupportedcurrencies

import "nantty/modules/currency/src/modules/exchangeRates/models"

type Query struct{}

type Result struct {
	Data       []models.CurrencyView `json:"data"`
	NextCursor *string               `json:"nextCursor"`
}
