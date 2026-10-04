package services

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"zudomart/modules/ads/src/types"
	"zudomart/platform/regionpricing"
)

type fakeSettingReader map[string]json.RawMessage

func (reader fakeSettingReader) ReadValue(_ context.Context, key string) (json.RawMessage, bool) {
	value, found := reader[key]
	return value, found
}

type fakeRates map[string]int64

func (rates fakeRates) UsdRatesE8(context.Context) map[string]int64 { return rates }

func audienceIn(countries ...string) types.AudienceSpec {
	spec := types.AudienceSpec{}
	for _, country := range countries {
		spec.Locations = append(spec.Locations, types.LocationTarget{Type: "country", Code: country, CountryCode: country})
	}
	return spec
}

func TestAdFloorsFollowTheTargetedRegion(t *testing.T) {
	pricing := &RegionalAdPricing{}
	ctx := context.Background()
	cases := []struct {
		countries []string
		currency  string
		cpm, cpc  int64
		daily     int64
	}{
		{[]string{"NG"}, "NGN", 50_000, 3_000, 100_000},
		{[]string{"GH"}, "GHS", 600, 40, 1_500},
		{[]string{"KE"}, "KES", 6_000, 400, 15_000},
		{[]string{"ZA"}, "ZAR", 1_500, 120, 4_000},
		{[]string{"GB"}, "GBP", 200, 15, 300},
		{[]string{"DE"}, "EUR", 200, 15, 300},
		{[]string{"US"}, "USD", 250, 20, 300},
		{[]string{"BR"}, "USD", 250, 20, 300},
	}
	for _, testCase := range cases {
		floors := pricing.FloorsForAudience(ctx, audienceIn(testCase.countries...), testCase.currency)
		if floors.CpmFloorMinor != testCase.cpm || floors.CpcFloorMinor != testCase.cpc || floors.MinimumDailyBudgetMinor != testCase.daily {
			t.Fatalf("%v in %s: %+v", testCase.countries, testCase.currency, floors)
		}
	}
	nigerianAdvertiserTargetingUk := pricing.FloorsForAudience(ctx, audienceIn("GB"), "NGN")
	if nigerianAdvertiserTargetingUk.MinimumDailyBudgetMinor != 588_608 {
		t.Fatalf("GB minimum billed in NGN %+v", nigerianAdvertiserTargetingUk)
	}
	if empty := pricing.FloorsForAudience(ctx, types.AudienceSpec{}, "KES"); empty.MinimumDailyBudgetMinor != 15_000 {
		t.Fatalf("no locations uses the billing currency's region %+v", empty)
	}
}

func TestAdminRegionalPricingAndLiveRatesOverrideTheDefaults(t *testing.T) {
	document, _ := json.Marshal(regionpricing.SettingDocument{Ads: []regionpricing.AdRegionPricing{{Region: "NG", Currency: "NGN", CpmFloorMinor: 80_000, CpcFloorMinor: 5_000, MinimumDailyBudgetMinor: 200_000, BoostMinimumDailyMinor: 150_000}}})
	rates := fakeRates{"USD": 100_000_000, "NGN": 160_000_000_000}
	pricing := &RegionalAdPricing{Settings: fakeSettingReader{regionpricing.SettingKey: document}, Rates: rates}
	ctx := context.Background()
	if floors := pricing.FloorsForCountries(ctx, []string{"NG"}, "NGN"); floors.CpmFloorMinor != 80_000 || floors.BoostMinimumDailyMinor != 150_000 {
		t.Fatalf("admin override ignored %+v", floors)
	}
	if reserve, ok := pricing.ReservePerMilleMinor(ctx, "NG", "USD"); !ok || reserve != 50 {
		t.Fatalf("NG reserve in USD %d %v", reserve, ok)
	}
	if reserve, ok := pricing.ReservePerMilleMinor(ctx, "JP", "USD"); !ok || reserve != 250 {
		t.Fatalf("unknown viewer country uses the US floor %d", reserve)
	}
	if _, ok := pricing.ReservePerMilleMinor(ctx, "NG", "JPY"); ok {
		t.Fatal("an unsupported ad currency has no reserve")
	}
	spend, ok := pricing.ConvertForReporting(ctx, types.Money{AmountMinor: 1_600_000, Currency: "NGN"}, "USD")
	if !ok || spend.AmountMinor != 1_000 {
		t.Fatalf("reporting conversion %+v", spend)
	}
}

func TestCreatorShareIsTheSamePercentageInEveryRegion(t *testing.T) {
	pricing := &RegionalAdPricing{}
	ctx := context.Background()
	share, multiplier := ResolveCreatorShare(nil, false, time.Now())
	for _, region := range regionpricing.SupportedRegions() {
		floors := pricing.FloorsForCountries(ctx, []string{region.Code}, region.Currency)
		if region.Code == "EU" {
			floors = pricing.FloorsForCountries(ctx, []string{"FR"}, region.Currency)
		}
		chargeMicros := floors.CpmFloorMinor * types.MicrosPerMinorUnit * 37
		split := SplitRevenueBetweenCreatorAndPlatform(chargeMicros, share, multiplier, true)
		if share != DefaultCreatorShareBps || split.CreatorMicros*10_000 != chargeMicros*4_000 || split.CreatorMicros+split.PlatformMicros != chargeMicros {
			t.Fatalf("%s creator share %d of %d (share %d bps)", region.Code, split.CreatorMicros, chargeMicros, share)
		}
	}
}
