package money

import "errors"

var ErrInvalidAllocationWeights = errors.New("allocation needs at least one non-negative weight with a positive total")

func (amount Money) AllocateByWeightsWithoutLosingMinorUnits(weights []int64) ([]Money, error) {
	var totalWeight int64
	for _, weight := range weights {
		if weight < 0 {
			return nil, ErrInvalidAllocationWeights
		}
		totalWeight += weight
	}
	if len(weights) == 0 || totalWeight <= 0 {
		return nil, ErrInvalidAllocationWeights
	}
	shares := make([]Money, len(weights))
	var allocated int64
	for index, weight := range weights {
		share := amount.AmountMinor / totalWeight * weight
		share += amount.AmountMinor % totalWeight * weight / totalWeight
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
