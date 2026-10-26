package services

import (
	"slices"

	"github.com/google/uuid"

	"nantty/modules/orders/src/enums"
)

type ShippingDestinationRule struct {
	CountryCode string
	RegionId    *uuid.UUID
	AdminAreaId *uuid.UUID
}

type ShippingZoneRule struct {
	Id           uuid.UUID
	Name         string
	Active       bool
	Destinations []ShippingDestinationRule
}

type ShippingFeeRule struct {
	Id                 uuid.UUID
	ZoneId             uuid.UUID
	FeeMinor           int64
	IsFree             bool
	FreeThresholdMinor *int64
	Active             bool
}

type ShippingProfileRules struct {
	Id                 uuid.UUID
	Currency           string
	FreeThresholdMinor *int64
	Zones              []ShippingZoneRule
	Rules              []ShippingFeeRule
}

type DeliveryLocation struct {
	CountryCode string
	RegionId    *uuid.UUID
	AdminAreaId *uuid.UUID
}

type ShippingResult struct {
	Outcome               string
	FeeMinor              int64
	ProfileId             *uuid.UUID
	ZoneId                *uuid.UUID
	RuleId                *uuid.UUID
	ZoneName              string
	MatchedLevel          string
	ThresholdAppliedMinor *int64
}

func levelOfDestination(destination ShippingDestinationRule, location DeliveryLocation) int {
	if destination.CountryCode != location.CountryCode {
		return 0
	}
	switch {
	case destination.AdminAreaId != nil:
		if location.AdminAreaId != nil && *destination.AdminAreaId == *location.AdminAreaId {
			return 3
		}
	case destination.RegionId != nil:
		if location.RegionId != nil && *destination.RegionId == *location.RegionId {
			return 2
		}
	default:
		return 1
	}
	return 0
}

func levelOfZone(zone ShippingZoneRule, location DeliveryLocation) int {
	best := 0
	for _, destination := range zone.Destinations {
		best = max(best, levelOfDestination(destination, location))
	}
	return best
}

func MatchedLevelName(level int) string {
	switch level {
	case 3:
		return enums.LevelAdminArea
	case 2:
		return enums.LevelRegion
	case 1:
		return enums.LevelCountry
	}
	return ""
}

func CalculateShippingForOrderGroup(profile *ShippingProfileRules, location DeliveryLocation, subtotalMinor int64) ShippingResult {
	notDeliverable := ShippingResult{Outcome: enums.ShippingNotDeliverable}
	if profile == nil {
		return notDeliverable
	}
	zones := map[uuid.UUID]ShippingZoneRule{}
	for _, zone := range profile.Zones {
		if zone.Active {
			zones[zone.Id] = zone
		}
	}
	type candidate struct {
		rule  ShippingFeeRule
		zone  ShippingZoneRule
		level int
	}
	candidates := []candidate{}
	for _, rule := range profile.Rules {
		zone, found := zones[rule.ZoneId]
		if !rule.Active || !found {
			continue
		}
		if level := levelOfZone(zone, location); level > 0 {
			candidates = append(candidates, candidate{rule: rule, zone: zone, level: level})
		}
	}
	if len(candidates) == 0 {
		return notDeliverable
	}
	slices.SortFunc(candidates, func(left, right candidate) int {
		switch {
		case left.level != right.level:
			return right.level - left.level
		case left.rule.IsFree != right.rule.IsFree:
			if left.rule.IsFree {
				return -1
			}
			return 1
		case left.rule.FeeMinor != right.rule.FeeMinor:
			return int(left.rule.FeeMinor - right.rule.FeeMinor)
		}
		return slices.Compare(left.rule.Id[:], right.rule.Id[:])
	})
	chosen := candidates[0]
	result := ShippingResult{
		Outcome: enums.ShippingFee, FeeMinor: chosen.rule.FeeMinor, ProfileId: &profile.Id, ZoneId: &chosen.zone.Id, RuleId: &chosen.rule.Id,
		ZoneName: chosen.zone.Name, MatchedLevel: MatchedLevelName(chosen.level),
	}
	if chosen.rule.IsFree {
		result.Outcome, result.FeeMinor = enums.ShippingFreeRule, 0
		return result
	}
	if threshold := lowestThresholdMet(subtotalMinor, chosen.rule.FreeThresholdMinor, profile.FreeThresholdMinor); threshold != nil {
		result.Outcome, result.FeeMinor, result.ThresholdAppliedMinor = enums.ShippingFreeThreshold, 0, threshold
	}
	return result
}

func lowestThresholdMet(subtotalMinor int64, thresholds ...*int64) *int64 {
	var met *int64
	for _, threshold := range thresholds {
		if threshold != nil && *threshold > 0 && subtotalMinor >= *threshold && (met == nil || *threshold < *met) {
			met = threshold
		}
	}
	return met
}

func AmountToFreeShipping(result ShippingResult, profile *ShippingProfileRules, subtotalMinor int64) *int64 {
	if result.Outcome != enums.ShippingFee || profile == nil {
		return nil
	}
	var lowest *int64
	for _, rule := range profile.Rules {
		if result.RuleId != nil && rule.Id == *result.RuleId && rule.FreeThresholdMinor != nil {
			lowest = rule.FreeThresholdMinor
		}
	}
	if profile.FreeThresholdMinor != nil && (lowest == nil || *profile.FreeThresholdMinor < *lowest) {
		lowest = profile.FreeThresholdMinor
	}
	if lowest == nil || *lowest <= subtotalMinor {
		return nil
	}
	remaining := *lowest - subtotalMinor
	return &remaining
}
