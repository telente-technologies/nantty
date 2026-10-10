package money

import (
	"errors"
	"math/big"
)

var ErrInvalidAllocationWeights = errors.New("allocation needs at least one non-negative weight with a positive total")

func (amount Money) AllocateByWeightsWithoutLosingMinorUnits(weights []int64) ([]Money, error) {
	totalWeight := new(big.Int)
	for _, weight := range weights {
		if weight < 0 {
			return nil, ErrInvalidAllocationWeights
		}
		totalWeight.Add(totalWeight, big.NewInt(weight))
	}
	if len(weights) == 0 || totalWeight.Sign() <= 0 {
		return nil, ErrInvalidAllocationWeights
	}
	shares := make([]Money, len(weights))
	var allocated int64
	for index, weight := range weights {
		numerator := new(big.Int).Mul(big.NewInt(amount.AmountMinor), big.NewInt(weight))
		share := new(big.Int).Quo(numerator, totalWeight).Int64()
		shares[index] = Money{AmountMinor: share, Currency: amount.Currency}
		allocated += share
	}
	remainder := amount.AmountMinor - allocated
	step := int64(1)
	if remainder < 0 {
		step = -1
	}
	for index := 0; remainder != 0; index = (index + 1) % len(shares) {
		if weights[index] == 0 {
			continue
		}
		shares[index].AmountMinor += step
		remainder -= step
	}
	return shares, nil
}
