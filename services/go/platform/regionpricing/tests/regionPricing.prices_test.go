package regionpricing_test

import (
	"encoding/json"
	. "nantty/platform/regionpricing"
	"testing"
)

func TestEveryPlanHasAPricePerRegionInThatRegionsCurrency(t *testing.T) {
	prices := DefaultPlanPrices()
	if len(prices) != 7*len(SupportedRegions()) {
		t.Fatalf("%d prices", len(prices))
	}
	for _, price := range prices {
		region, _ := FindRegion(price.Region)
		expectedCurrency := region.Currency
		if price.PlanCode == "black" {
			expectedCurrency = BlackCurrencyCode
		}
		if price.Currency != expectedCurrency || price.WebMonthlyMinor <= 0 || price.WebYearlyMinor >= price.WebMonthlyMinor*12 {
			t.Fatalf("bad price %+v", price)
		}
		if price.PlanCode == "black" && price.WebYearlyMinor != 0 {
			t.Fatalf("black annual billing must be disabled: %+v", price)
		}
		hasInAppProduct := price.StoreProductIdFor("ios", "month") != ""
		if hasInAppProduct && (price.IosMonthlyMinor < price.WebMonthlyMinor || price.StoreProductIdFor("android", "month") == "") {
			t.Fatalf("in-app plan %+v", price)
		}
		if !hasInAppProduct && (price.AmountFor("ios", "month") != 0 || price.StoreProductIdFor("android", "year") != "") {
			t.Fatalf("web-only plan sold in app %+v", price)
		}
	}
}

func TestPriceLookupPerCountry(t *testing.T) {
	cases := []struct {
		country, plan, channel, interval string
		amount                           int64
		currency                         string
	}{
		{"NG", "blue", "web", "month", 250_000, "NGN"},
		{"NG", "premium", "web", "month", 2_000_000, "NGN"},
		{"NG", "seller_business", "web", "month", 3_000_000, "NGN"},
		{"NG", "blue", "ios", "month", GrossUpForStoreFee(250_000, DefaultStoreFeeSettings().AppleFeeBps, "NGN"), "NGN"},
		{"NG", "seller_business", "ios", "month", GrossUpForStoreFee(3_000_000, DefaultStoreFeeSettings().AppleFeeBps, "NGN"), "NGN"},
		{"NG", "seller_pro", "android", "month", GrossUpForStoreFee(500_000, DefaultStoreFeeSettings().GoogleSubscriptionFeeBps, "NGN"), "NGN"},
		{"NG", "blue", "web", "year", 2_400_000, "NGN"},
		{"GH", "premium", "android", "month", 6_500, "GHS"},
		{"KE", "seller_pro", "web", "month", 100_000, "KES"},
		{"ZA", "blue", "web", "month", 5_999, "ZAR"},
		{"GB", "blue", "web", "year", 5_799, "GBP"},
		{"IE", "premium", "web", "month", 1_099, "EUR"},
		{"NG", "black", "web", "month", 30_000, "USD"},
		{"NG", "black", "web", "year", 0, "USD"},
		{"GH", "black", "web", "month", 50_000, "USD"},
		{"GB", "black", "web", "month", 50_000, "USD"},
		{"US", "black", "web", "month", 50_000, "USD"},
		{"JP", "blue", "web", "month", 599, "USD"},
	}
	for _, testCase := range cases {
		region, _ := RegionForCountry(testCase.country)
		price, found := FindDefaultPlanPrice(testCase.plan, region.Code)
		if !found || price.Currency != testCase.currency || price.AmountFor(testCase.channel, testCase.interval) != testCase.amount {
			t.Fatalf("%+v got %+v -> %d", testCase, price, price.AmountFor(testCase.channel, testCase.interval))
		}
	}
}

func TestRoundToPricePoint(t *testing.T) {
	cases := map[string][2]int64{
		"NGN": {2_399_950, 2_400_000}, "KES": {57_601, 58_000}, "GHS": {28_801, 28_900}, "ZAR": {57_590, 57_599}, "GBP": {5_750, 5_799}, "USD": {599, 599}, "EUR": {119, 119},
	}
	for currency, pair := range cases {
		if got := RoundToPricePoint(pair[0], currency); got != pair[1] {
			t.Fatalf("%s %d -> %d, want %d", currency, pair[0], got, pair[1])
		}
	}
}

func TestCoinPacksArePricedInEveryCurrencyAndTheWebIsCheaper(t *testing.T) {
	for _, tier := range DefaultCoinPackTiers {
		web, app := CoinPackPrices(tier.Coins, "web"), CoinPackPrices(tier.Coins, "ios")
		if len(web) != 7 || len(app) != 7 {
			t.Fatalf("tier %s missing currencies", tier.Tier)
		}
		for currency, amount := range web {
			if amount <= 0 || app[currency] <= amount {
				t.Fatalf("tier %s %s web %d app %d", tier.Tier, currency, amount, app[currency])
			}
		}
	}
	if CoinPackPrices(100, "web")["NGN"] != 100_000 || CoinPackPrices(1_000, "android")["USD"] != 1_199 {
		t.Fatal("coin anchors moved")
	}
}

func TestSettingDocumentFallsBackToDefaultsAndRejectsBadRows(t *testing.T) {
	if ValidateSettingDocument(DefaultSettingDocument()) != nil {
		t.Fatal("defaults must validate")
	}
	raw, _ := json.Marshal(SettingDocument{Ads: []AdRegionPricing{{Region: "KE", Currency: "KES", CpmFloorMinor: 9_000, CpcFloorMinor: 500, MinimumDailyBudgetMinor: 20_000, BoostMinimumDailyMinor: 20_000}}})
	document := ParseSettingDocument(raw, true)
	if FindAdRegionPricing(document.Ads, "KE").CpmFloorMinor != 9_000 || FindAdRegionPricing(document.Ads, "NG").CpmFloorMinor != 40_000 || FindAdRegionPricing(document.Ads, "KE").SuggestedCpmMinor != 17_000 {
		t.Fatalf("merge failed %+v", document.Ads)
	}
	bad, _ := json.Marshal(SettingDocument{Ads: []AdRegionPricing{{Region: "KE", Currency: "USD", CpmFloorMinor: 1, CpcFloorMinor: 1, MinimumDailyBudgetMinor: 1, BoostMinimumDailyMinor: 1}}})
	if FindAdRegionPricing(ParseSettingDocument(bad, true).Ads, "KE").Currency != "KES" {
		t.Fatal("an invalid document must fall back to defaults")
	}
}
