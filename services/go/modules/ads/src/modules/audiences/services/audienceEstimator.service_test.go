package services

import (
	"testing"
	"time"

	"nantty/modules/ads/src/modules/audiences/dtos"
	"nantty/modules/ads/src/types"
)

func nigeria() types.AudienceSpec {
	return types.AudienceSpec{Locations: []types.LocationTarget{{Type: "country", Code: "NG", CountryCode: "NG"}}, AgeMin: 18, AgeMax: 65, Gender: "all"}
}

func inputs() EstimateInputs {
	return EstimateInputs{Population: map[string]int64{"NG": 9_000_000}, CustomAudienceSizes: map[string]int64{"a": 400}, ReservePerMilleMinor: map[string]int64{"NGN": 50_000}, BaselineCtrPpm: 15_000, Now: time.Now()}
}

func TestNarrowingByStateAgeGenderAndCustomAudienceShrinksTheModelledSize(t *testing.T) {
	broad := ModelAudienceSize(nigeria(), inputs())
	narrow := nigeria()
	narrow.Locations = []types.LocationTarget{{Type: "state", Code: "LA", CountryCode: "NG"}}
	narrow.AgeMin, narrow.AgeMax, narrow.Gender = 25, 34, "female"
	if got := ModelAudienceSize(narrow, inputs()); got >= broad/10 {
		t.Fatalf("narrow %d should be far below broad %d", got, broad)
	}
	narrow.CustomAudienceIds = []string{"a"}
	if got := ModelAudienceSize(narrow, inputs()); got > 400 {
		t.Fatalf("a custom audience caps the size at its members, got %d", got)
	}
}

func TestEstimateReturnsRangesWithAWarningWhenThereIsNoBudget(t *testing.T) {
	withoutBudget := Estimate(dtos.EstimateRequest{Objective: "traffic", Audience: nigeria()}, inputs())
	if withoutBudget.DailyReach != nil || len(withoutBudget.Warnings) == 0 {
		t.Fatalf("expected a budget warning and no reach, got %+v", withoutBudget)
	}
	budget := &types.Budget{Type: "daily", Amount: types.Money{AmountMinor: 500_000, Currency: "NGN"}}
	estimate := Estimate(dtos.EstimateRequest{Objective: "traffic", Audience: nigeria(), Budget: budget, Placements: []string{"feed", "clips"}}, inputs())
	if estimate.DailyReach == nil || estimate.DailyResults == nil || estimate.DailyReach.Lower >= estimate.DailyReach.Upper || estimate.ResultLabel != "Link clicks" {
		t.Fatalf("unexpected estimate %+v", estimate)
	}
}

func TestBreadthClassifiesByAudienceSize(t *testing.T) {
	for size, want := range map[int64]string{10: "too_narrow", 5_000: "narrow", 500_000: "balanced", 9_000_000: "broad"} {
		if got := Breadth(size); got != want {
			t.Fatalf("size %d: got %s want %s", size, got, want)
		}
	}
}
