package models

import (
	"errors"
	"time"

	"zudomart/platform/regionpricing"
)

const (
	CreatorShareOfNetBps        = 8000
	CreatorRenewalRetryInterval = 24 * time.Hour
	CreatorRenewalGracePeriod   = 3 * 24 * time.Hour
	CreatorPlanMaximumBenefits  = 20
	CreatorPlanMinimumMinor     = 100
	yearlyBandFloorMonths       = 10
)

var (
	ErrCreatorPriceOutsideBands = errors.New("price is outside the regional creator subscription bands")
	ErrCreatorPriceNoBands      = errors.New("no creator subscription bands for this currency")
)

type CreatorPlanBenefit struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type CreatorChargeSplit struct {
	NetMinor          int64
	CreatorShareMinor int64
	PlatformMinor     int64
}

func SplitCreatorSubscriptionCharge(amountMinor, providerFeeMinor int64) CreatorChargeSplit {
	net := max(amountMinor-max(providerFeeMinor, 0), 0)
	creator := net/10_000*CreatorShareOfNetBps + net%10_000*CreatorShareOfNetBps/10_000
	return CreatorChargeSplit{NetMinor: net, CreatorShareMinor: creator, PlatformMinor: amountMinor - creator}
}

func HasCreatorSubscriberAccess(status string, currentPeriodEnd *time.Time, now time.Time) bool {
	switch status {
	case "active", "past_due", "cancelled":
		return currentPeriodEnd != nil && currentPeriodEnd.After(now)
	}
	return false
}

func NextCreatorPeriodEnd(start time.Time, interval string) time.Time {
	return NextPeriodEnd(start, start.Day(), interval)
}

type CreatorPriceRange struct {
	MinimumMinor int64
	MaximumMinor int64
}

func CreatorPriceRangeFor(bands []regionpricing.CreatorSubscriptionBand, interval string) (CreatorPriceRange, error) {
	if len(bands) == 0 {
		return CreatorPriceRange{}, ErrCreatorPriceNoBands
	}
	lowest, highest := bands[0].WebMinor, bands[0].AppMinor
	for _, band := range bands {
		lowest, highest = min(lowest, band.WebMinor), max(highest, band.AppMinor, band.WebMinor)
	}
	if interval == "year" {
		return CreatorPriceRange{MinimumMinor: lowest * yearlyBandFloorMonths, MaximumMinor: highest * 12}, nil
	}
	return CreatorPriceRange{MinimumMinor: lowest, MaximumMinor: highest}, nil
}

func CheckCreatorPlanPrice(amountMinor int64, interval string, bands []regionpricing.CreatorSubscriptionBand) (CreatorPriceRange, error) {
	allowed, err := CreatorPriceRangeFor(bands, interval)
	if err != nil {
		return allowed, err
	}
	if amountMinor < max(allowed.MinimumMinor, CreatorPlanMinimumMinor) || amountMinor > allowed.MaximumMinor {
		return allowed, ErrCreatorPriceOutsideBands
	}
	return allowed, nil
}

func NormalizeCreatorPlanBenefits(names []string) []CreatorPlanBenefit {
	benefits := make([]CreatorPlanBenefit, 0, len(names))
	for _, name := range names {
		benefits = append(benefits, CreatorPlanBenefit{Name: name})
	}
	return benefits
}
