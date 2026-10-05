package regionpricing

import (
	"encoding/json"
	"testing"
)

func TestCreatorTiersSitInsideTheWebBands(t *testing.T) {
	for _, region := range SupportedRegions() {
		bands := DefaultCreatorSubscriptionBands(region.Code)
		lowest, highest := bands[0].WebMinor, bands[len(bands)-1].AppMinor
		ladder := CreatorTierLadder(region.Currency, "month")
		if len(ladder) != len(CreatorTierKeys) {
			t.Fatalf("%s ladder has %d tiers", region.Currency, len(ladder))
		}
		previous := int64(0)
		for _, price := range ladder {
			if price.AmountMinor < lowest || price.AmountMinor > highest || price.AmountMinor <= previous {
				t.Fatalf("%s tier %s = %d is outside %d..%d or not rising", region.Currency, price.Tier, price.AmountMinor, lowest, highest)
			}
			previous = price.AmountMinor
		}
	}
}

func TestNigeriaLadderAndYearlyTiers(t *testing.T) {
	if amount, found := CreatorTierWebPrice("1000", "ngn", "month"); !found || amount != 100_000 {
		t.Fatalf("₦1,000 tier %d %v", amount, found)
	}
	if amount, _ := CreatorTierWebPrice("1000", "NGN", "year"); amount != 1_000_000 {
		t.Fatalf("yearly is ten months, got %d", amount)
	}
	if tier, found := FindCreatorTier(150_000, "NGN", "month"); !found || tier != "1500" {
		t.Fatalf("₦1,500 maps to tier 1500, got %q %v", tier, found)
	}
	if _, found := FindCreatorTier(120_000, "NGN", "month"); found {
		t.Fatal("₦1,200 is not a tier")
	}
	if _, found := CreatorTierWebPrice("1000", "JPY", "month"); found {
		t.Fatal("unsupported currencies have no tiers")
	}
}

func TestGrossUpKeepsTheNetAtLeastTheWebPrice(t *testing.T) {
	cases := []struct {
		web, fee int64
		currency string
		want     int64
	}{
		{100_000, 3_000, "NGN", 150_000},
		{100_000, 1_500, "NGN", 120_000},
		{50_000, 3_000, "NGN", 80_000},
		{499, 3_000, "USD", 719},
		{499, 1_500, "USD", 589},
		{100_000, 0, "NGN", 100_000},
	}
	for _, testCase := range cases {
		got := GrossUpForStoreFee(testCase.web, testCase.fee, testCase.currency)
		if got != testCase.want {
			t.Fatalf("gross up %d at %d bps in %s = %d, want %d", testCase.web, testCase.fee, testCase.currency, got, testCase.want)
		}
		if net := got - (got*testCase.fee+9_999)/10_000; net < testCase.web {
			t.Fatalf("net %d after the store fee is below the web price %d", net, testCase.web)
		}
	}
}

func TestCreatorStoreProductIdsRoundTrip(t *testing.T) {
	id := CreatorStoreProductId("1000", "month", 3)
	if id != "zudomart.creatorsub.tier_1000.s3.monthly" {
		t.Fatalf("product id %s", id)
	}
	parsed, ok := ParseCreatorStoreProductId(id)
	if !ok || parsed.Tier != "1000" || parsed.Interval != "month" || parsed.Slot != 3 {
		t.Fatalf("parsed %+v %v", parsed, ok)
	}
	for _, bad := range []string{"zudomart.creatorsub.tier_1200.s1.monthly", "zudomart.creatorsub.tier_1000.s9.monthly", "com.zudomart.app.coins.tier1", "zudomart.creatorsub.tier_1000.s1.weekly"} {
		if _, ok := ParseCreatorStoreProductId(bad); ok {
			t.Fatalf("%s must not parse", bad)
		}
	}
}

func TestStoreFeeSettingsDefaultsAndSmallBusinessProgram(t *testing.T) {
	defaults := ParseStoreFeeSettings(nil, false)
	if defaults.FeeBpsForChannel("ios") != 3_000 || defaults.FeeBpsForChannel("android") != 1_500 || defaults.FeeBpsForChannel("web") != 0 {
		t.Fatalf("defaults %+v", defaults)
	}
	raw, _ := json.Marshal(StoreFeeSettings{AppleFeeBps: 3_000, AppleSmallBusinessProgram: true, AppleSmallBusinessFeeBps: 1_500, GoogleSubscriptionFeeBps: 1_500})
	if settings := ParseStoreFeeSettings(raw, true); settings.FeeBpsForChannel("ios") != 1_500 {
		t.Fatalf("small business program %+v", settings)
	}
	if settings := ParseStoreFeeSettings(json.RawMessage(`{"appleFeeBps":9000}`), true); settings.AppleFeeBps != 3_000 {
		t.Fatalf("invalid documents fall back to defaults %+v", settings)
	}
}
