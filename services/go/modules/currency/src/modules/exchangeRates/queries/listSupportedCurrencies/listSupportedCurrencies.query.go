package listsupportedcurrencies

import "zudomart/modules/currency/src/modules/exchangeRates/models"

type Query struct{}

type Result struct {
	Data       []models.CurrencyView `json:"data"`
	NextCursor *string               `json:"nextCursor"`
}
