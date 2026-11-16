package services_test

import (
	"testing"

	"nantty/modules/ads/src/modules/boosts/dtos"
	"nantty/modules/ads/src/modules/boosts/services"
	"nantty/modules/ads/src/types"
	"nantty/platform/regionpricing"
)

func TestBoostEstimateTotalsDailyBudgetOverDurationAndNarrowsCustomAudiences(t *testing.T) {
	request := dtos.BoostEstimateRequest{Goal: "views", Audience: dtos.BoostAudience{Mode: "automatic"}, DailyBudget: types.Money{AmountMinor: 100_000, Currency: "NGN"}, DurationDays: 7}
	estimate, err := regionpricing.EstimateCampaign(regionpricing.DefaultAdRegionPricing(), services.EstimateRequestForBoost(request), regionpricing.DefaultUsdRatesE8)
	if err != nil {
		t.Fatal(err)
	}
	automatic := services.EstimateBoost(request, estimate)
	if automatic.TotalCost.AmountMinor != 700_000 || automatic.EstimatedReachMin >= automatic.EstimatedReachMax {
		t.Fatalf("unexpected estimate %+v", automatic)
	}
	request.Audience.Mode = "custom"
	if custom := services.EstimateBoost(request, estimate); custom.EstimatedReachMax >= automatic.EstimatedReachMax || custom.Region != "NG" || custom.MinimumDailyBudget.AmountMinor != 100_000 {
		t.Fatal("a custom audience must narrow the reach")
	}
}

func TestAudienceForBoostMapsStatesAndInterests(t *testing.T) {
	spec := services.AudienceForBoost(dtos.BoostAudience{Mode: "custom", CountryCode: "NG", States: []string{"LA", "OG"}, Interests: []string{"Home & Living"}, AgeMin: 25, AgeMax: 40}, "NG")
	if len(spec.Locations) != 2 || spec.Locations[0].Type != "state" || spec.TopicIds[0] != "home-living" || spec.AgeMin != 25 {
		t.Fatalf("unexpected spec %+v", spec)
	}
	if automatic := services.AudienceForBoost(dtos.BoostAudience{Mode: "automatic"}, "GH"); automatic.Locations[0].Code != "GH" || automatic.AgeMin != 18 {
		t.Fatalf("automatic audience should cover the home country, got %+v", automatic)
	}
}
