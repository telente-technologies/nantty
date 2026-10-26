package listexchangeratehistory

import "nantty/modules/currency/src/modules/exchangeRates/models"

type Query struct {
	Currency string
	Cursor   string
}

type Result = models.RevisionsPage
