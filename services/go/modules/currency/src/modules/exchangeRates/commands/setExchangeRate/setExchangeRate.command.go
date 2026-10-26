package setexchangerate

import "nantty/modules/currency/src/modules/exchangeRates/models"

type Command struct {
	StaffId            string
	StaffRole          string
	Currency           string
	Rate               string
	Reason             string
	ConfirmLargeChange bool
	IpAddress          string
	UserAgent          string
	RequestId          string
}

type Result = models.RevisionView

type ExchangeRateUpdatedEventData struct {
	Currency          string `json:"currency"`
	PreviousUsdRateE8 int64  `json:"previousUsdRateE8"`
	UsdRateE8         int64  `json:"usdRateE8"`
	SetBy             string `json:"setBy"`
	Reason            string `json:"reason"`
}
