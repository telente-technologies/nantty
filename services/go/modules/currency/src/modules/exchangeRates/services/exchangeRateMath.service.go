package services

import (
	"errors"
	"math"
	"math/big"
	"strings"
)

const (
	RateScaleDigits = 8
	rateScale       = 100_000_000
)

var (
	ErrInvalidRate    = errors.New("rate must be a positive decimal with at most 8 fractional digits")
	ErrInvalidAmount  = errors.New("amount must be a non-negative integer of minor units")
	ErrAmountOverflow = errors.New("converted amount is too large")
)

func ParseDecimalRateToE8(raw string) (int64, error) {
	trimmed := strings.TrimSpace(raw)
	whole, fraction, _ := strings.Cut(trimmed, ".")
	if whole == "" || len(whole) > 10 || len(fraction) > RateScaleDigits || !onlyDigits(whole) || !onlyDigits(fraction) || (strings.Contains(trimmed, ".") && fraction == "") {
		return 0, ErrInvalidRate
	}
	padded := fraction + strings.Repeat("0", RateScaleDigits-len(fraction))
	value, ok := new(big.Int).SetString(whole+padded, 10)
	if !ok || value.Sign() <= 0 || !value.IsInt64() {
		return 0, ErrInvalidRate
	}
	return value.Int64(), nil
}

func onlyDigits(value string) bool {
	for _, character := range value {
		if character < '0' || character > '9' {
			return false
		}
	}
	return true
}

func FormatE8AsDecimal(rateE8 int64) string {
	whole, fraction := rateE8/rateScale, rateE8%rateScale
	if fraction == 0 {
		return big.NewInt(whole).String()
	}
	digits := strings.TrimRight(padLeft(big.NewInt(fraction).String(), RateScaleDigits), "0")
	return big.NewInt(whole).String() + "." + digits
}

func padLeft(value string, width int) string {
	if len(value) >= width {
		return value
	}
	return strings.Repeat("0", width-len(value)) + value
}

func ConvertMinorUnitsWithFloor(amountMinor, fromUsdRateE8, toUsdRateE8 int64) (int64, error) {
	if amountMinor < 0 {
		return 0, ErrInvalidAmount
	}
	if fromUsdRateE8 <= 0 || toUsdRateE8 <= 0 {
		return 0, ErrInvalidRate
	}
	product := new(big.Int).Mul(big.NewInt(amountMinor), big.NewInt(toUsdRateE8))
	quotient := product.Div(product, big.NewInt(fromUsdRateE8))
	if !quotient.IsInt64() || quotient.Int64() > math.MaxInt64 {
		return 0, ErrAmountOverflow
	}
	return quotient.Int64(), nil
}

func ExceedsChangeLimit(currentE8, proposedE8 int64, limitPercent int64) bool {
	difference := new(big.Int).Sub(big.NewInt(proposedE8), big.NewInt(currentE8))
	difference.Abs(difference).Mul(difference, big.NewInt(100))
	return difference.Cmp(new(big.Int).Mul(big.NewInt(currentE8), big.NewInt(limitPercent))) > 0
}
