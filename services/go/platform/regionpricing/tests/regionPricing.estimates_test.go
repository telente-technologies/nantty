package regionpricing_test

import (
	. "nantty/platform/regionpricing"
	"strings"
	"testing"
)

func TestEstimateForOneRegionCoversTheWholeDuration(t *testing.T) {
	estimate, err := EstimateCampaign(DefaultAdRegionPricing(), EstimateRequest{Countries: []string{"NG"}, BillingCurrency: "NGN", BudgetType: "daily", BudgetMinor: 500_000, Days: 7, Objective: "traffic"}, DefaultUsdRatesE8)
	if err != nil {
		t.Fatal(err)
	}
	if estimate.TotalCostMinor != 3_500_000 || estimate.MinimumDailyBudgetMinor != 100_000 || estimate.SuggestedDailyBudgetMinor != 500_000 || estimate.SuggestedLifetimeBudgetMinor != 3_500_000 {
		t.Fatalf("totals %+v", estimate)
	}
	if estimate.Impressions.Low != 17_948 || estimate.Impressions.High != 31_111 || estimate.ResultKind != "clicks" || estimate.Results != estimate.Clicks {
		t.Fatalf("impressions %+v results %+v", estimate.Impressions, estimate.Results)
	}
	if estimate.CostPerResult.Low <= 0 || estimate.CostPerResult.Low > estimate.CostPerResult.High || estimate.BelowMinimum {
		t.Fatalf("cost per result %+v", estimate.CostPerResult)
	}
}

func TestEstimateSplitsAcrossRegionsInTheBillingCurrency(t *testing.T) {
	request := EstimateRequest{Countries: []string{"GB", "NG", "DE"}, BillingCurrency: "NGN", BudgetType: "lifetime", BudgetMinor: 30_000_000, Days: 10, Objective: "awareness", RegionWeights: map[string]int64{"NG": 3, "GB": 1, "EU": 1}}
	estimate, err := EstimateCampaign(DefaultAdRegionPricing(), request, DefaultUsdRatesE8)
	if err != nil {
		t.Fatal(err)
	}
	if len(estimate.Regions) != 3 || estimate.DailyBudgetMinor != 3_000_000 || estimate.TotalCostMinor != 30_000_000 || estimate.ResultKind != "reach" {
		t.Fatalf("split %+v", estimate)
	}
	byRegion := map[string]RegionEstimate{}
	shares := int64(0)
	for _, region := range estimate.Regions {
		byRegion[region.Region] = region
		shares += region.DailyBudgetMinor
	}
	if shares != 3_000_000 || byRegion["NG"].DailyBudgetMinor != 1_800_000 || byRegion["GB"].BudgetShareBps != 2_000 {
		t.Fatalf("shares %+v", byRegion)
	}
	if byRegion["GB"].ExchangeNote == "" || !strings.HasPrefix(byRegion["GB"].ExchangeNote, "1 GBP ≈ 1962.02 NGN") || byRegion["NG"].ExchangeNote != "" {
		t.Fatalf("fx notes %q %q", byRegion["GB"].ExchangeNote, byRegion["NG"].ExchangeNote)
	}
	if byRegion["NG"].Impressions.High <= byRegion["GB"].Impressions.High {
		t.Fatal("the cheaper region should deliver more impressions for its larger share")
	}
	if estimate.MinimumDailyBudgetMinor != byRegion["GB"].MinimumDailyBudgetMinor && estimate.MinimumDailyBudgetMinor != byRegion["EU"].MinimumDailyBudgetMinor {
		t.Fatalf("minimum must be the strictest region %+v", estimate.MinimumDailyBudgetMinor)
	}
}

func TestEstimateRejectsBadInputAndFlagsSmallBudgets(t *testing.T) {
	for _, request := range []EstimateRequest{
		{BillingCurrency: "NGN", BudgetType: "daily", BudgetMinor: 1, Days: 0},
		{BillingCurrency: "JPY", BudgetType: "daily", BudgetMinor: 1, Days: 1},
		{BillingCurrency: "NGN", BudgetType: "weekly", BudgetMinor: 1, Days: 1},
	} {
		if _, err := EstimateCampaign(DefaultAdRegionPricing(), request, DefaultUsdRatesE8); err == nil {
			t.Fatalf("accepted %+v", request)
		}
	}
	small, _ := EstimateCampaign(DefaultAdRegionPricing(), EstimateRequest{Countries: []string{"US"}, BillingCurrency: "USD", BudgetType: "daily", BudgetMinor: 100, Days: 3}, DefaultUsdRatesE8)
	if !small.BelowMinimum || !small.Regions[0].BelowRegionMinimum {
		t.Fatalf("small budget not flagged %+v", small)
	}
}

func TestBoostPackagesPerRegion(t *testing.T) {
	packages, err := BoostPackages(DefaultAdRegionPricing(), "KE", "KES", DefaultUsdRatesE8)
	if err != nil || len(packages) != 4 {
		t.Fatalf("%v %v", packages, err)
	}
	if packages[0].Price != 15_000 || packages[2].Days != 7 || packages[3].Price != 225_000 || packages[3].EstimatedReach.High <= packages[2].EstimatedReach.High {
		t.Fatalf("packages %+v", packages)
	}
	if pounds, _ := BoostPackages(DefaultAdRegionPricing(), "GB", "GBP", DefaultUsdRatesE8); pounds[1].Price != 1_500 {
		t.Fatalf("local packages keep exact multiples %+v", pounds[1])
	}
	inNaira, _ := BoostPackages(DefaultAdRegionPricing(), "GB", "NGN", DefaultUsdRatesE8)
	if inNaira[0].Currency != "NGN" || inNaira[0].Price != 990_000 {
		t.Fatalf("GB boost billed in NGN %+v", inNaira[0])
	}
}
