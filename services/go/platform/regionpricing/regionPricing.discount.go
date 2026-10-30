package regionpricing

import (
	"errors"
	"math/big"
	"strings"
)

type DiscountKind string

const (
	DiscountPercentage   DiscountKind = "percentage"
	DiscountFixed        DiscountKind = "fixed"
	DiscountAnnual       DiscountKind = "annual"
	DiscountBundleTotal  DiscountKind = "bundle_total"
	DiscountBundleHigher DiscountKind = "bundle_higher"
)

var ErrInvalidDiscount = errors.New("invalid subscription discount")

// DiscountInput is one mutually exclusive discount. Callers must not stack
// promo, annual, or bundle discounts by passing several inputs.
type DiscountInput struct {
	Kind            DiscountKind
	Currency        string
	SubtotalMinor   int64
	HigherPlanMinor int64
	DiscountMinor   int64
	DiscountRateBps int64
}

type DiscountResult struct {
	Currency       string       `json:"currency"`
	OriginalMinor  int64        `json:"originalMinor"`
	DiscountMinor  int64        `json:"discountMinor"`
	PayableMinor   int64        `json:"payableMinor"`
	AppliedKind    DiscountKind `json:"appliedKind"`
	AppliedRateBps int64        `json:"appliedRateBps"`
}

// CalculateDiscount computes a single discount using integer currency minor
// units. Bundle variants are explicit so the undecided policy cannot silently
// choose between discounting the combined subtotal or only the higher plan.
func CalculateDiscount(input DiscountInput) (DiscountResult, error) {
	if strings.TrimSpace(input.Currency) == "" || input.SubtotalMinor <= 0 {
		return DiscountResult{}, ErrInvalidDiscount
	}
	base := input.SubtotalMinor
	if input.Kind == DiscountBundleHigher {
		if input.HigherPlanMinor <= 0 || input.HigherPlanMinor > input.SubtotalMinor {
			return DiscountResult{}, ErrInvalidDiscount
		}
		base = input.HigherPlanMinor
	}

	discount := int64(0)
	rate := input.DiscountRateBps
	switch input.Kind {
	case DiscountPercentage, DiscountAnnual, DiscountBundleTotal, DiscountBundleHigher:
		if rate <= 0 || rate > 10_000 {
			return DiscountResult{}, ErrInvalidDiscount
		}
		value := new(big.Int).Mul(big.NewInt(base), big.NewInt(rate))
		value.Add(value, big.NewInt(5_000))
		value.Div(value, big.NewInt(10_000))
		if !value.IsInt64() {
			return DiscountResult{}, ErrInvalidDiscount
		}
		discount = value.Int64()
	case DiscountFixed:
		if input.DiscountMinor <= 0 {
			return DiscountResult{}, ErrInvalidDiscount
		}
		discount = input.DiscountMinor
		rate = 0
	default:
		return DiscountResult{}, ErrInvalidDiscount
	}
	if discount > input.SubtotalMinor {
		discount = input.SubtotalMinor
	}
	return DiscountResult{
		Currency: input.Currency, OriginalMinor: input.SubtotalMinor,
		DiscountMinor: discount, PayableMinor: input.SubtotalMinor - discount,
		AppliedKind: input.Kind, AppliedRateBps: rate,
	}, nil
}
