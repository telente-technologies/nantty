package regionpricing

import (
	"errors"
	"math"
	"math/big"
)

var (
	ErrInvalidPriceTarget = errors.New("net target must be a positive minor-unit amount")
	ErrInvalidFeeRate     = errors.New("percentage fee rates must be non-negative and total less than 100 percent")
	ErrInvalidFixedFee    = errors.New("fixed fees must be non-negative minor-unit amounts")
	ErrPriceOverflow      = errors.New("calculated gross price exceeds the supported minor-unit range")
)

// GrossUpForFees calculates the smallest currency price point that preserves
// netTargetMinor after percentage fees and a fixed fee. All percentage fees
// must use the same pre-tax gross base; taxes and fees with different bases
// must be resolved separately by the caller. Integer minor units are used
// throughout, and the configured currency price-point rounding is applied last.
func GrossUpForFees(netTargetMinor, fixedFeeMinor int64, feeRatesBps []int64, currency string) (int64, error) {
	if netTargetMinor <= 0 {
		return 0, ErrInvalidPriceTarget
	}
	if fixedFeeMinor < 0 {
		return 0, ErrInvalidFixedFee
	}

	var totalRate int64
	for _, rate := range feeRatesBps {
		if rate < 0 || rate >= 10_000 || totalRate >= 10_000-rate {
			return 0, ErrInvalidFeeRate
		}
		totalRate += rate
	}

	base := new(big.Int).Add(big.NewInt(netTargetMinor), big.NewInt(fixedFeeMinor))
	numerator := new(big.Int).Mul(base, big.NewInt(10_000))
	denominator := big.NewInt(10_000 - totalRate)
	quotient, remainder := new(big.Int), new(big.Int)
	quotient.QuoRem(numerator, denominator, remainder)
	if remainder.Sign() != 0 {
		quotient.Add(quotient, big.NewInt(1))
	}
	if !quotient.IsInt64() || quotient.Int64() > math.MaxInt64-50_000 {
		return 0, ErrPriceOverflow
	}

	pricePoint := RoundToPricePoint(quotient.Int64(), currency)
	if pricePoint <= 0 || pricePoint < quotient.Int64() {
		return 0, ErrPriceOverflow
	}
	return pricePoint, nil
}
