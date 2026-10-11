package services

import (
	"context"
	"fmt"

	"zudomart/modules/ads/src/container"
)

type Limits struct {
	Minimum int64
	Maximum int64
}

var ValueAddedTaxBasisPointsByCurrency = map[string]int64{"NGN": 750, "GHS": 1500, "KES": 1600, "ZAR": 1500, "GBP": 2000, "EUR": 2000, "USD": 0}

var ReceiptedTransactionTypes = map[string]bool{"top_up": true, "refund": true, "card_charge": true}

func TopUpLimits(ctx context.Context, deployed *container.Container, currency string) Limits {
	minimum := deployed.Pricing.FloorsForCountries(ctx, nil, currency).MinimumDailyBudgetMinor
	return Limits{Minimum: minimum * 5, Maximum: deployed.Pricing.AdsTopUpMaximum(ctx, currency)}
}

func FormatMinor(amountMinor int64, currency string) string {
	sign := ""
	if amountMinor < 0 {
		sign, amountMinor = "-", -amountMinor
	}
	return fmt.Sprintf("%s%s %d.%02d", sign, currency, amountMinor/100, amountMinor%100)
}
