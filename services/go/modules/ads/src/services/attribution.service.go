package services

import (
	"slices"
	"time"

	"nantty/platform/money"
)

const (
	DefaultCreatorShareBps    int64 = 4_000
	DefaultAiMultiplierBps    int64 = 3_000
	DefaultOriginalMultiplier int64 = 10_000
	ContentTypeOriginal             = "original"
	ContentTypeAiGenerated          = "ai_generated"
)

type MonetizationPolicyRow struct {
	ContentType     string
	CreatorShareBps int64
	MultiplierBps   int64
	EffectiveFrom   time.Time
	EffectiveTo     *time.Time
}

type RevenueSplit struct {
	ChargeMicros   int64
	CreatorMicros  int64
	PlatformMicros int64
}

func ResolveCreatorShare(rows []MonetizationPolicyRow, aiGenerated bool, at time.Time) (shareBps, multiplierBps int64) {
	return ResolveCreatorShareWithDefault(rows, aiGenerated, at, DefaultCreatorShareBps)
}

func ResolveCreatorShareWithDefault(rows []MonetizationPolicyRow, aiGenerated bool, at time.Time, defaultShareBps int64) (shareBps, multiplierBps int64) {
	contentType := ContentTypeOriginal
	fallbackMultiplier := DefaultOriginalMultiplier
	if aiGenerated {
		contentType, fallbackMultiplier = ContentTypeAiGenerated, DefaultAiMultiplierBps
	}
	best := -1
	for index, row := range rows {
		if row.ContentType != contentType || row.EffectiveFrom.After(at) || (row.EffectiveTo != nil && !row.EffectiveTo.After(at)) {
			continue
		}
		if best < 0 || row.EffectiveFrom.After(rows[best].EffectiveFrom) {
			best = index
		}
	}
	if best < 0 {
		return defaultShareBps, fallbackMultiplier
	}
	return rows[best].CreatorShareBps, rows[best].MultiplierBps
}

func SplitRevenueBetweenCreatorAndPlatform(chargeMicros, creatorShareBps, multiplierBps int64, creatorEligible bool) RevenueSplit {
	if chargeMicros <= 0 || !creatorEligible {
		return RevenueSplit{ChargeMicros: max(chargeMicros, 0), PlatformMicros: max(chargeMicros, 0)}
	}
	effectiveBps := creatorShareBps * multiplierBps / 10_000
	effectiveBps = min(max(effectiveBps, 0), 10_000)
	creator := divideRoundingHalfToEven(chargeMicros*effectiveBps, 10_000)
	return RevenueSplit{ChargeMicros: chargeMicros, CreatorMicros: creator, PlatformMicros: chargeMicros - creator}
}

func divideRoundingHalfToEven(numerator, denominator int64) int64 {
	quotient, remainder := numerator/denominator, numerator%denominator
	twice := remainder * 2
	if twice > denominator || (twice == denominator && quotient%2 == 1) {
		return quotient + 1
	}
	return quotient
}

type ConsumptionWeight struct {
	CreatorUserId string
	WatchSeconds  int64
}

type PremiumAllocation struct {
	CreatorUserId string
	AmountMinor   int64
}

func AllocatePremiumPoolByConsumption(poolMinor int64, currency string, consumption []ConsumptionWeight) ([]PremiumAllocation, error) {
	sorted := slices.Clone(consumption)
	sorted = slices.DeleteFunc(sorted, func(weight ConsumptionWeight) bool { return weight.WatchSeconds <= 0 })
	slices.SortFunc(sorted, func(left, right ConsumptionWeight) int {
		if left.CreatorUserId < right.CreatorUserId {
			return -1
		}
		if left.CreatorUserId > right.CreatorUserId {
			return 1
		}
		return 0
	})
	if len(sorted) == 0 || poolMinor <= 0 {
		return nil, nil
	}
	weights := make([]int64, len(sorted))
	for index, entry := range sorted {
		weights[index] = entry.WatchSeconds
	}
	total, err := money.NewMoneyFromMinorUnits(poolMinor, currency)
	if err != nil {
		return nil, err
	}
	shares, err := total.AllocateByWeightsWithoutLosingMinorUnits(weights)
	if err != nil {
		return nil, err
	}
	allocations := make([]PremiumAllocation, len(sorted))
	for index, entry := range sorted {
		allocations[index] = PremiumAllocation{CreatorUserId: entry.CreatorUserId, AmountMinor: shares[index].AmountMinor}
	}
	return allocations, nil
}

func WholeMinorUnitsAndCarry(micros int64) (minor, carryMicros int64) {
	return micros / 1_000_000, micros % 1_000_000
}
