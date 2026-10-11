package money

import (
	"bytes"
	"encoding/json"
	"errors"
	"math"
	"strconv"
	"strings"
)

var (
	ErrInvalidDecimalAmount  = errors.New("amount must be a plain decimal number such as 2000.50")
	ErrNegativeAmount        = errors.New("amount must not be negative")
	ErrTooManyFractionDigits = errors.New("amount has more decimal places than the currency allows")
)

func ParseMajorUnits(text string, currency string) (int64, error) {
	code, err := ParseCurrencyCode(currency)
	if err != nil {
		return 0, err
	}
	text = strings.TrimSpace(text)
	if strings.HasPrefix(text, "-") {
		return 0, ErrNegativeAmount
	}
	whole, fraction, hasPoint := strings.Cut(text, ".")
	if whole == "" || (hasPoint && fraction == "") {
		return 0, ErrInvalidDecimalAmount
	}
	whole, err = removeThousandsSeparators(whole)
	if err != nil {
		return 0, err
	}
	if !allDigits(whole) || !allDigits(fraction) {
		return 0, ErrInvalidDecimalAmount
	}
	exponent := MinorUnitExponentForCurrency(code)
	if len(fraction) > exponent {
		if strings.Trim(fraction[exponent:], "0") != "" {
			return 0, ErrTooManyFractionDigits
		}
		fraction = fraction[:exponent]
	}
	fraction += strings.Repeat("0", exponent-len(fraction))
	return combineMinorUnits(whole, fraction)
}

func ParseMajorUnitsFromJson(raw json.RawMessage, currency string) (int64, error) {
	raw = bytes.TrimSpace(raw)
	if len(raw) == 0 || string(raw) == "null" {
		return 0, ErrInvalidDecimalAmount
	}
	if raw[0] == '"' {
		var text string
		if err := json.Unmarshal(raw, &text); err != nil {
			return 0, ErrInvalidDecimalAmount
		}
		return ParseMajorUnits(text, currency)
	}
	if bytes.ContainsAny(raw, ",eE+") {
		return 0, ErrInvalidDecimalAmount
	}
	return ParseMajorUnits(string(raw), currency)
}

func FormatMajorUnits(amountMinor int64, currency string) (string, error) {
	code, err := ParseCurrencyCode(currency)
	if err != nil {
		return "", err
	}
	sign := ""
	magnitude := strconv.FormatUint(uint64(amountMinor), 10)
	if amountMinor < 0 {
		sign = "-"
		magnitude = strconv.FormatUint(uint64(-(amountMinor+1))+1, 10)
	}
	exponent := MinorUnitExponentForCurrency(code)
	if exponent == 0 {
		return sign + magnitude, nil
	}
	if len(magnitude) <= exponent {
		magnitude = strings.Repeat("0", exponent-len(magnitude)+1) + magnitude
	}
	split := len(magnitude) - exponent
	return sign + magnitude[:split] + "." + magnitude[split:], nil
}

func removeThousandsSeparators(whole string) (string, error) {
	if !strings.Contains(whole, ",") {
		return whole, nil
	}
	groups := strings.Split(whole, ",")
	if len(groups[0]) < 1 || len(groups[0]) > 3 {
		return "", ErrInvalidDecimalAmount
	}
	for _, group := range groups[1:] {
		if len(group) != 3 {
			return "", ErrInvalidDecimalAmount
		}
	}
	return strings.Join(groups, ""), nil
}

func allDigits(text string) bool {
	for index := 0; index < len(text); index++ {
		if text[index] < '0' || text[index] > '9' {
			return false
		}
	}
	return true
}

func combineMinorUnits(whole, fraction string) (int64, error) {
	digits := strings.TrimLeft(whole+fraction, "0")
	if digits == "" {
		return 0, nil
	}
	if len(digits) > 19 {
		return 0, ErrAmountOverflow
	}
	value, err := strconv.ParseUint(digits, 10, 64)
	if err != nil || value > math.MaxInt64 {
		return 0, ErrAmountOverflow
	}
	return int64(value), nil
}
