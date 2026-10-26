package utils

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"

	"nantty/platform/money"
)

var ErrInvalidProviderAmount = errors.New("provider amount is not a valid decimal in this currency")

func FormatMinorUnitsAsMajorDecimal(amountMinor int64, currency string) (json.Number, error) {
	if amountMinor < 0 {
		return "", ErrInvalidProviderAmount
	}
	exponent := money.MinorUnitExponentForCurrency(money.CurrencyCode(currency))
	if exponent == 0 {
		return json.Number(strconv.FormatInt(amountMinor, 10)), nil
	}
	divisor := int64(math.Pow10(exponent))
	return json.Number(fmt.Sprintf("%d.%0*d", amountMinor/divisor, exponent, amountMinor%divisor)), nil
}

func ParseMajorDecimalToMinorUnits(raw string, currency string) (int64, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" || strings.HasPrefix(raw, "-") || strings.HasPrefix(raw, "+") || strings.ContainsAny(raw, "eE") {
		return 0, ErrInvalidProviderAmount
	}
	exponent := money.MinorUnitExponentForCurrency(money.CurrencyCode(currency))
	whole, fraction, _ := strings.Cut(raw, ".")
	fraction = strings.TrimRight(fraction, "0")
	if len(fraction) > exponent || whole == "" {
		return 0, ErrInvalidProviderAmount
	}
	fraction += strings.Repeat("0", exponent-len(fraction))
	digits := whole + fraction
	for _, character := range digits {
		if character < '0' || character > '9' {
			return 0, ErrInvalidProviderAmount
		}
	}
	amount, err := strconv.ParseInt(digits, 10, 64)
	if err != nil {
		return 0, ErrInvalidProviderAmount
	}
	return amount, nil
}

type TransferFeeTier struct {
	UpToAmountMinor int64
	FeeMinor        int64
}

func FeeForAmountFromTiers(tiers []TransferFeeTier, amountMinor int64) int64 {
	for _, tier := range tiers {
		if tier.UpToAmountMinor == 0 || amountMinor <= tier.UpToAmountMinor {
			return tier.FeeMinor
		}
	}
	return tiers[len(tiers)-1].FeeMinor
}

func PlatformFeeForAmount(amountMinor, commissionBps int64) int64 {
	if amountMinor <= 0 || commissionBps <= 0 {
		return 0
	}
	sellerShareBps := 10_000 - commissionBps
	sellerShare := amountMinor/10_000*sellerShareBps + amountMinor%10_000*sellerShareBps/10_000
	return amountMinor - sellerShare
}
