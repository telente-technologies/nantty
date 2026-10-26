package services

import (
	"testing"

	"github.com/google/uuid"

	"nantty/modules/orders/src/enums"
)

type shippingFixture struct {
	profile                         *ShippingProfileRules
	nigeria, ogun, abeokuta         uuid.UUID
	countryRule, stateRule, lgaRule uuid.UUID
}

func newShippingFixture() shippingFixture {
	fixture := shippingFixture{nigeria: uuid.New(), ogun: uuid.New(), abeokuta: uuid.New(), countryRule: uuid.New(), stateRule: uuid.New(), lgaRule: uuid.New()}
	countryZone, stateZone, lgaZone := uuid.New(), uuid.New(), uuid.New()
	fixture.profile = &ShippingProfileRules{
		Id: uuid.New(), Currency: "NGN",
		Zones: []ShippingZoneRule{
			{Id: countryZone, Name: "Nationwide", Active: true, Destinations: []ShippingDestinationRule{{CountryCode: "NG"}}},
			{Id: stateZone, Name: "Ogun", Active: true, Destinations: []ShippingDestinationRule{{CountryCode: "NG", RegionId: &fixture.ogun}}},
			{Id: lgaZone, Name: "Abeokuta", Active: true, Destinations: []ShippingDestinationRule{{CountryCode: "NG", RegionId: &fixture.ogun, AdminAreaId: &fixture.abeokuta}}},
		},
		Rules: []ShippingFeeRule{
			{Id: fixture.countryRule, ZoneId: countryZone, FeeMinor: 500000, Active: true},
			{Id: fixture.stateRule, ZoneId: stateZone, FeeMinor: 200000, Active: true},
			{Id: fixture.lgaRule, ZoneId: lgaZone, FeeMinor: 100000, Active: true},
		},
	}
	return fixture
}

func TestMostSpecificDestinationWins(t *testing.T) {
	fixture := newShippingFixture()
	lagos := uuid.New()
	cases := []struct {
		name     string
		location DeliveryLocation
		fee      int64
		level    string
	}{
		{"local government area", DeliveryLocation{CountryCode: "NG", RegionId: &fixture.ogun, AdminAreaId: &fixture.abeokuta}, 100000, enums.LevelAdminArea},
		{"state", DeliveryLocation{CountryCode: "NG", RegionId: &fixture.ogun}, 200000, enums.LevelRegion},
		{"country", DeliveryLocation{CountryCode: "NG", RegionId: &lagos}, 500000, enums.LevelCountry},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			result := CalculateShippingForOrderGroup(fixture.profile, testCase.location, 1_000_000)
			if result.Outcome != enums.ShippingFee || result.FeeMinor != testCase.fee || result.MatchedLevel != testCase.level {
				t.Fatalf("got %+v", result)
			}
		})
	}
}

func TestUnservedCountryAndMissingProfileAreNotDeliverable(t *testing.T) {
	fixture := newShippingFixture()
	if CalculateShippingForOrderGroup(fixture.profile, DeliveryLocation{CountryCode: "GH"}, 1_000_000).Outcome != enums.ShippingNotDeliverable {
		t.Fatal("Ghana is not served")
	}
	if CalculateShippingForOrderGroup(nil, DeliveryLocation{CountryCode: "NG"}, 1_000_000).Outcome != enums.ShippingNotDeliverable {
		t.Fatal("a store without shipping rules is not deliverable")
	}
}

func TestInactiveRulesAndZonesAreIgnored(t *testing.T) {
	fixture := newShippingFixture()
	fixture.profile.Rules[2].Active = false
	fixture.profile.Zones[1].Active = false
	result := CalculateShippingForOrderGroup(fixture.profile, DeliveryLocation{CountryCode: "NG", RegionId: &fixture.ogun, AdminAreaId: &fixture.abeokuta}, 0)
	if result.FeeMinor != 500000 || result.MatchedLevel != enums.LevelCountry {
		t.Fatalf("expected the nationwide rule, got %+v", result)
	}
}

func TestFreeRuleAndThresholds(t *testing.T) {
	fixture := newShippingFixture()
	location := DeliveryLocation{CountryCode: "NG", RegionId: &fixture.ogun}
	fixture.profile.Rules[1].IsFree = true
	if result := CalculateShippingForOrderGroup(fixture.profile, location, 100); result.Outcome != enums.ShippingFreeRule || result.FeeMinor != 0 {
		t.Fatalf("free rule not applied: %+v", result)
	}
	fixture.profile.Rules[1].IsFree = false
	threshold := int64(5_000_000)
	fixture.profile.FreeThresholdMinor = &threshold
	if result := CalculateShippingForOrderGroup(fixture.profile, location, 4_999_999); result.Outcome != enums.ShippingFee || result.FeeMinor != 200000 {
		t.Fatalf("below threshold must charge the fee: %+v", result)
	}
	result := CalculateShippingForOrderGroup(fixture.profile, location, 5_000_000)
	if result.Outcome != enums.ShippingFreeThreshold || result.FeeMinor != 0 || result.ThresholdAppliedMinor == nil || *result.ThresholdAppliedMinor != threshold {
		t.Fatalf("at the threshold shipping is free: %+v", result)
	}
}

func TestAmountToFreeShipping(t *testing.T) {
	fixture := newShippingFixture()
	threshold := int64(5_000_000)
	fixture.profile.FreeThresholdMinor = &threshold
	location := DeliveryLocation{CountryCode: "NG", RegionId: &fixture.ogun}
	result := CalculateShippingForOrderGroup(fixture.profile, location, 3_000_000)
	remaining := AmountToFreeShipping(result, fixture.profile, 3_000_000)
	if remaining == nil || *remaining != 2_000_000 {
		t.Fatalf("remaining = %v", remaining)
	}
	if AmountToFreeShipping(CalculateShippingForOrderGroup(fixture.profile, location, 6_000_000), fixture.profile, 6_000_000) != nil {
		t.Fatal("nothing remains once shipping is free")
	}
}
