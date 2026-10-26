package convertmoney

import "nantty/modules/currency/src/modules/exchangeRates/models"

type Query struct {
	AmountMinor int64
	From        string
	To          string
}

type Result = models.ConvertedMoney
