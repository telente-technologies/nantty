package models

import (
	"errors"
	"testing"
	"time"

	"zudomart/platform/regionpricing"
)

func TestCreatorKeepsEightyPercentOfNetAfterTheProviderFee(t *testing.T) {
	split := SplitCreatorSubscriptionCharge(100_000, 1_500)
	if split.NetMinor != 98_500 || split.CreatorShareMinor != 78_800 || split.PlatformMinor != 21_200 {
		t.Fatalf("split: %+v", split)
	}
	if rounded := SplitCreatorSubscriptionCharge(199, 7); rounded.CreatorShareMinor != 153 || rounded.CreatorShareMinor+rounded.PlatformMinor != 199 {
		t.Fatalf("the creator share rounds down and the parts add up: %+v", rounded)
	}
	if fee := SplitCreatorSubscriptionCharge(500, 900); fee.CreatorShareMinor != 0 || fee.PlatformMinor != 500 {
		t.Fatalf("a fee above the price leaves nothing to share: %+v", fee)
	}
}

func TestSubscriberAccessLastsUntilThePeriodEnds(t *testing.T) {
	now := time.Date(2026, 10, 5, 12, 0, 0, 0, time.UTC)
	future, past := now.Add(time.Hour), now.Add(-time.Hour)
	cases := []struct {
		status string
		end    *time.Time
		want   bool
	}{
		{"active", &future, true}, {"past_due", &future, true}, {"cancelled", &future, true},
		{"cancelled", &past, false}, {"active", nil, false}, {"pending", &future, false}, {"expired", &future, false}, {"failed", &future, false},
	}
	for _, testCase := range cases {
		if got := HasCreatorSubscriberAccess(testCase.status, testCase.end, now); got != testCase.want {
			t.Errorf("%s ending %v: got %v", testCase.status, testCase.end, got)
		}
	}
}

func TestCreatorPlanPriceMustSitInsideTheRegionalBands(t *testing.T) {
	bands := regionpricing.DefaultCreatorSubscriptionBands("NG")
	if _, err := CheckCreatorPlanPrice(50_000, "month", bands); err != nil {
		t.Fatalf("the Supporter web price is allowed: %v", err)
	}
	if _, err := CheckCreatorPlanPrice(590_000, "month", bands); err != nil {
		t.Fatalf("the VIP app price is allowed: %v", err)
	}
	if _, err := CheckCreatorPlanPrice(49_999, "month", bands); !errors.Is(err, ErrCreatorPriceOutsideBands) {
		t.Fatalf("below the lowest band: %v", err)
	}
	if _, err := CheckCreatorPlanPrice(590_001, "month", bands); !errors.Is(err, ErrCreatorPriceOutsideBands) {
		t.Fatalf("above the highest band: %v", err)
	}
	yearly, err := CheckCreatorPlanPrice(500_000, "year", bands)
	if err != nil || yearly.MinimumMinor != 500_000 || yearly.MaximumMinor != 590_000*12 {
		t.Fatalf("yearly range is ten lowest months to twelve highest: %+v %v", yearly, err)
	}
	if _, err := CheckCreatorPlanPrice(1_000, "month", nil); !errors.Is(err, ErrCreatorPriceNoBands) {
		t.Fatalf("no bands: %v", err)
	}
}

func TestCreatorPeriodsFollowTheCalendar(t *testing.T) {
	start := time.Date(2026, 1, 31, 9, 0, 0, 0, time.UTC)
	if end := NextCreatorPeriodEnd(start, "month"); !end.Equal(time.Date(2026, 2, 28, 9, 0, 0, 0, time.UTC)) {
		t.Fatalf("month: %v", end)
	}
	if end := NextCreatorPeriodEnd(start, "year"); !end.Equal(time.Date(2027, 1, 31, 9, 0, 0, 0, time.UTC)) {
		t.Fatalf("year: %v", end)
	}
}
