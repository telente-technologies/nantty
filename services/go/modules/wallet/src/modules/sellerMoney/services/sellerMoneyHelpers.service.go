package services

import "zudomart/platform/money"

func moneyOf(amountMinor int64, currency string) money.Money {
	return money.Money{AmountMinor: amountMinor, Currency: money.CurrencyCode(currency)}
}

func MaskAccountName(name string) string {
	runes := []rune(name)
	if len(runes) <= 6 {
		if len(runes) <= 2 {
			return string(runes) + "***"
		}
		return string(runes[:2]) + "***"
	}
	return string(runes[:len(runes)/2]) + "***" + string(runes[len(runes)-2:])
}

func MaskAccountNumber(lastFour string) string {
	return "******" + lastFour
}
