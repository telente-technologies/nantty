package services

import (
	"errors"
	"regexp"
	"strconv"
	"strings"

	"zudomart/platform/money"
)

var amountPattern = regexp.MustCompile(`^\d{1,12}(\.\d{1,3})?$`)

var errInvalidAmount = errors.New("invalid amount")

func ParseMajorAmountToMinor(text string, currency money.CurrencyCode) (int64, error) {
	cleaned := strings.ReplaceAll(strings.TrimSpace(text), ",", "")
	if !amountPattern.MatchString(cleaned) {
		return 0, errInvalidAmount
	}
	exponent := money.MinorUnitExponentForCurrency(currency)
	whole, fraction, _ := strings.Cut(cleaned, ".")
	if len(fraction) > exponent {
		return 0, errInvalidAmount
	}
	fraction += strings.Repeat("0", exponent-len(fraction))
	value, err := strconv.ParseInt(whole+fraction, 10, 64)
	if err != nil || value > 100_000_000_000 {
		return 0, errInvalidAmount
	}
	return value, nil
}

func ParseOptionalWholeNumber(text string, fallback, maximum int) (int, bool) {
	trimmed := strings.TrimSpace(text)
	if trimmed == "" {
		return fallback, true
	}
	value, err := strconv.Atoi(trimmed)
	if err != nil || value < 0 || value > maximum {
		return 0, false
	}
	return value, true
}

func ParseYesNo(text string) bool {
	switch strings.ToLower(strings.TrimSpace(text)) {
	case "yes", "y", "true", "1":
		return true
	}
	return false
}
