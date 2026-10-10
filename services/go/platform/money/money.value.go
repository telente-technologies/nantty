package money

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"regexp"
)

type CurrencyCode string

type Money struct {
	AmountMinor int64        `json:"amountMinor"`
	Currency    CurrencyCode `json:"currency"`
}

var (
	ErrInvalidCurrencyCode = errors.New("currency must be an ISO 4217 code such as USD")
	ErrCurrencyMismatch    = errors.New("cannot combine amounts in different currencies")
	ErrAmountOverflow      = errors.New("amount overflows int64 minor units")
)

var isoCurrencyCodePattern = regexp.MustCompile(`^[A-Z]{3}$`)

var minorUnitExponentByCurrency = map[CurrencyCode]int{
	"JPY": 0, "KRW": 0, "UGX": 0, "XAF": 0, "XOF": 0, "RWF": 0,
	"BHD": 3, "KWD": 3, "OMR": 3, "TND": 3, "JOD": 3,
}

func ParseCurrencyCode(raw string) (CurrencyCode, error) {
	if !isoCurrencyCodePattern.MatchString(raw) {
		return "", ErrInvalidCurrencyCode
	}
	return CurrencyCode(raw), nil
}

func MinorUnitExponentForCurrency(currency CurrencyCode) int {
	if exponent, known := minorUnitExponentByCurrency[currency]; known {
		return exponent
	}
	return 2
}

func NewMoneyFromMinorUnits(amountMinor int64, currency string) (Money, error) {
	code, err := ParseCurrencyCode(currency)
	if err != nil {
		return Money{}, err
	}
	return Money{AmountMinor: amountMinor, Currency: code}, nil
}

func ZeroMoneyInCurrency(currency CurrencyCode) Money {
	return Money{Currency: currency}
}

func (amount Money) IsZero() bool     { return amount.AmountMinor == 0 }
func (amount Money) IsNegative() bool { return amount.AmountMinor < 0 }
func (amount Money) IsPositive() bool { return amount.AmountMinor > 0 }

func (amount Money) Add(other Money) (Money, error) {
	if amount.Currency != other.Currency {
		return Money{}, ErrCurrencyMismatch
	}
	sum := amount.AmountMinor + other.AmountMinor
	if (other.AmountMinor > 0 && sum < amount.AmountMinor) || (other.AmountMinor < 0 && sum > amount.AmountMinor) {
		return Money{}, ErrAmountOverflow
	}
	return Money{AmountMinor: sum, Currency: amount.Currency}, nil
}

func (amount Money) Subtract(other Money) (Money, error) {
	if other.AmountMinor == math.MinInt64 {
		return Money{}, ErrAmountOverflow
	}
	return amount.Add(Money{AmountMinor: -other.AmountMinor, Currency: other.Currency})
}

func (amount Money) MultiplyByQuantity(quantity int64) (Money, error) {
	product, err := multiplyInt64WithoutOverflow(amount.AmountMinor, quantity)
	if err != nil {
		return Money{}, ErrAmountOverflow
	}
	return Money{AmountMinor: product, Currency: amount.Currency}, nil
}

func (amount Money) ApplyBasisPointsRoundingHalfToEven(basisPoints int64) (Money, error) {
	numerator, err := multiplyInt64WithoutOverflow(amount.AmountMinor, basisPoints)
	if err != nil {
		return Money{}, ErrAmountOverflow
	}
	return Money{AmountMinor: divideRoundingHalfToEven(numerator, 10_000), Currency: amount.Currency}, nil
}

func multiplyInt64WithoutOverflow(left, right int64) (int64, error) {
	if left == 0 || right == 0 {
		return 0, nil
	}
	if left > 0 {
		if (right > 0 && left > math.MaxInt64/right) || (right < 0 && right < math.MinInt64/left) {
			return 0, ErrAmountOverflow
		}
	} else if (right > 0 && left < math.MinInt64/right) || (right < 0 && left < math.MaxInt64/right) {
		return 0, ErrAmountOverflow
	}
	return left * right, nil
}

func (amount Money) String() string {
	return fmt.Sprintf("%d %s (minor units)", amount.AmountMinor, amount.Currency)
}

func (amount *Money) UnmarshalJSON(data []byte) error {
	var raw struct {
		AmountMinor *int64 `json:"amountMinor"`
		Currency    string `json:"currency"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	if raw.AmountMinor == nil {
		return errors.New("amountMinor is required")
	}
	parsed, err := NewMoneyFromMinorUnits(*raw.AmountMinor, raw.Currency)
	if err != nil {
		return err
	}
	*amount = parsed
	return nil
}

func divideRoundingHalfToEven(numerator, denominator int64) int64 {
	quotient := numerator / denominator
	remainder := numerator % denominator
	if remainder == 0 {
		return quotient
	}
	doubledRemainder := 2 * remainder
	if doubledRemainder < 0 {
		doubledRemainder = -doubledRemainder
	}
	direction := int64(1)
	if (numerator < 0) != (denominator < 0) {
		direction = -1
	}
	if doubledRemainder > denominator || (doubledRemainder == denominator && quotient%2 != 0) {
		return quotient + direction
	}
	return quotient
}
