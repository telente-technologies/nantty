package regionpricing

import "strings"

// Small charge that proves a card works when a free trial saves it; it is refunded the moment the card is saved.
var cardVerificationChargeMinor = map[string]int64{"NGN": 5_000, "GHS": 100, "KES": 1_000, "ZAR": 500, "GBP": 100, "EUR": 100, "USD": 100}

func CardVerificationCharge(currency string) (int64, string) {
	code := strings.ToUpper(strings.TrimSpace(currency))
	if amount, found := cardVerificationChargeMinor[code]; found {
		return amount, code
	}
	return cardVerificationChargeMinor[FallbackRegion.Currency], FallbackRegion.Currency
}
