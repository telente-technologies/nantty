package services

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"nantty/modules/ads/src/types"
	"nantty/platform/regionpricing"
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
		{[]string{"NG"}, "NGN", 40_000, 2_500, 100_000},
		{[]string{"GH"}, "GHS", 600, 40, 1_500},
		{[]string{"KE"}, "KES", 8_000, 500, 15_000},
		{[]string{"ZA"}, "ZAR", 2_800, 150, 4_000},
		{[]string{"GB"}, "GBP", 250, 30, 500},
		{[]string{"DE"}, "EUR", 300, 30, 500},
		{[]string{"US"}, "USD", 350, 35, 500},
		{[]string{"BR"}, "USD", 350, 35, 500},
	}
	for _, testCase := range cases {
		floors := pricing.FloorsForAudience(ctx, audienceIn(testCase.countries...), testCase.currency)
		if floors.CpmFloorMinor != testCase.cpm || floors.CpcFloorMinor != testCase.cpc || floors.MinimumDailyBudgetMinor != testCase.daily {
			t.Fatalf("%v in %s: %+v", testCase.countries, testCase.currency, floors)
		}
	}
	nigerianAdvertiserTargetingUk := pricing.FloorsForAudience(ctx, audienceIn("GB"), "NGN")
	if nigerianAdvertiserTargetingUk.MinimumDailyBudgetMinor != 981_013 {
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
	if reserve, ok := pricing.ReservePerMilleMinor(ctx, "JP", "USD"); !ok || reserve != 350 {
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
