package models

import (
	"time"

	"nantty/modules/currency/src/generated/ent"
	"nantty/modules/currency/src/modules/exchangeRates/services"
)

type CurrencyView struct {
	Code       string `json:"code"`
	Name       string `json:"name"`
	MinorUnits int    `json:"minorUnits"`
	UsdRateE8  int64  `json:"usdRateE8"`
	Rate       string `json:"rate"`
	UpdatedAt  string `json:"updatedAt"`
}

type RevisionView struct {
	Id        string `json:"id"`
	Currency  string `json:"currency"`
	UsdRateE8 int64  `json:"usdRateE8"`
	Rate      string `json:"rate"`
	Source    string `json:"source"`
	SetBy     string `json:"setBy"`
	Reason    string `json:"reason"`
	CreatedAt string `json:"createdAt"`
}

type RevisionsPage struct {
	Data       []RevisionView `json:"data"`
	NextCursor *string        `json:"nextCursor"`
}

type ConvertedMoney struct {
	AmountMinor int64  `json:"amountMinor"`
	Currency    string `json:"currency"`
	RateE8      int64  `json:"rateE8"`
}

func ConvertRevisionToView(row *ent.ExchangeRateRevision) RevisionView {
	return RevisionView{
		Id: row.ID.String(), Currency: row.Currency, UsdRateE8: row.UsdRateE8, Rate: services.FormatE8AsDecimal(row.UsdRateE8),
		Source: string(row.Source), SetBy: row.SetBy, Reason: row.Reason, CreatedAt: row.CreatedAt.UTC().Format(time.RFC3339),
	}
}
