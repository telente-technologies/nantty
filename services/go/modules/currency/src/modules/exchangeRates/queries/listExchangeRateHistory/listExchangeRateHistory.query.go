package listexchangeratehistory

import "zudomart/modules/currency/src/modules/exchangeRates/models"

type Query struct {
	Currency string
	Cursor   string
}

type Result = models.RevisionsPage
