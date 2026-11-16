package models_test

import (
	"testing"

	"nantty/modules/subscriptions/src/models"
)

func TestCombinedGoldTierTableFromOneToFiveProfiles(t *testing.T) {
	rules := models.DefaultCombinedGoldRules(2000)
	want := map[int]int64{0: 0, 1: 500, 2: 1000, 3: 1200, 4: 1400, 5: 1600, 6: 1600}
	for profiles, bps := range want {
		if got := models.CombinedGoldTierBps(rules, profiles); got != bps {
			t.Fatalf("%d profiles: %d bps, want %d", profiles, got, bps)
		}
	}
	for profiles, totalMinor := range map[int]int64{1: 285_000, 2: 540_000, 3: 792_000, 4: 1_032_000, 5: 1_260_000} {
		quote := models.QuoteCombinedGold(rules, models.CombinedGoldInput{UnitMonthlyMinor: 300_000, ProfileCount: profiles, Interval: "month", TierAllowed: true})
		if quote.TotalMinor != totalMinor || quote.GrossMinor != 300_000*int64(profiles) || quote.TierDiscountMinor != quote.GrossMinor-totalMinor {
			t.Fatalf("%d profiles monthly: %+v", profiles, quote)
		}
	}
}

func TestCombinedGoldOwnersWorkedExampleThreeProfilesYearly(t *testing.T) {
	rules := models.DefaultCombinedGoldRules(2000)
	monthly := models.QuoteCombinedGold(rules, models.CombinedGoldInput{UnitMonthlyMinor: 300_000, ProfileCount: 3, Interval: "month", TierAllowed: true})
	if monthly.GrossMinor != 900_000 || monthly.TotalMinor != 792_000 {
		t.Fatalf("₦9,000 less 12%% is ₦7,920: %+v", monthly)
	}
	yearly := models.QuoteCombinedGold(rules, models.CombinedGoldInput{UnitMonthlyMinor: 300_000, ProfileCount: 3, Interval: "year", TierAllowed: true})
	if yearly.GrossMinor != 10_800_000 || yearly.TierDiscountMinor != 10_800_000-9_504_000 || yearly.YearlyExtraDiscountMinor != 475_200 || yearly.TotalMinor != 9_028_800 {
		t.Fatalf("₦95,040 less 5%% is ₦90,288: %+v", yearly)
	}
	if yearly.StandardYearlyDiscountMinor != 0 || yearly.StandardYearlyBps != 0 {
		t.Fatalf("the extra 5%% replaces the normal 20%% by default: %+v", yearly)
	}
	if len(yearly.LineItems) != 3 || yearly.LineItems[0].AmountMinor+yearly.LineItems[1].AmountMinor+yearly.LineItems[2].AmountMinor != yearly.TotalMinor {
		t.Fatalf("line items add up to the total: %+v", yearly.LineItems)
	}
}

func TestCombinedGoldYearlyAddModeStacksTheNormalYearlyDiscount(t *testing.T) {
	rules := models.DefaultCombinedGoldRules(2000)
	rules.YearlyMode = models.CombinedGoldYearlyAddsToStandard
	yearly := models.QuoteCombinedGold(rules, models.CombinedGoldInput{UnitMonthlyMinor: 300_000, ProfileCount: 3, Interval: "year", TierAllowed: true})
	if yearly.StandardYearlyDiscountMinor != 1_805_760 || yearly.TotalMinor != 7_223_040 {
		t.Fatalf("add mode takes 20%% off after the extra 5%%: %+v", yearly)
	}
}

func TestCombinedGoldWithoutPremiumHasNoTierAndOnlyTheNormalYearlyDiscount(t *testing.T) {
	rules := models.DefaultCombinedGoldRules(2000)
	monthly := models.QuoteCombinedGold(rules, models.CombinedGoldInput{UnitMonthlyMinor: 300_000, ProfileCount: 3, Interval: "month"})
	if monthly.TotalMinor != 900_000 || monthly.TierBps != 0 || monthly.AsPriceQuote().DiscountKind != "none" {
		t.Fatalf("a lapsed Premium renews at the full price: %+v", monthly)
	}
	yearly := models.QuoteCombinedGold(rules, models.CombinedGoldInput{UnitMonthlyMinor: 300_000, ProfileCount: 3, Interval: "year"})
	if yearly.TotalMinor != 8_640_000 || yearly.YearlyExtraDiscountMinor != 0 || yearly.AsPriceQuote().DiscountKind != "yearly" {
		t.Fatalf("yearly without Premium is the normal 20%% off: %+v", yearly)
	}
}

func TestCombinedGoldRoundsHalfUpInMinorUnitsAndSharesAddUp(t *testing.T) {
	rules := models.DefaultCombinedGoldRules(2000)
	quote := models.QuoteCombinedGold(rules, models.CombinedGoldInput{UnitMonthlyMinor: 999, ProfileCount: 3, Interval: "year", TierAllowed: true})
	monthly := int64(2_997) - (2_997*1_200+5_000)/10_000
	afterExtra := monthly*12 - (monthly*12*500+5_000)/10_000
	if quote.TotalMinor != afterExtra {
		t.Fatalf("rounding: %d want %d", quote.TotalMinor, afterExtra)
	}
	sum := int64(0)
	for _, share := range quote.PerProfileMinor {
		sum += share
	}
	if sum != quote.TotalMinor || len(quote.PerProfileMinor) != 3 || quote.PerProfileMinor[0]-quote.PerProfileMinor[2] > 1 {
		t.Fatalf("per-profile shares: %v of %d", quote.PerProfileMinor, quote.TotalMinor)
	}
}

func TestCombinedGoldBestSingleDiscountAgainstAnOffer(t *testing.T) {
	rules := models.DefaultCombinedGoldRules(2000)
	quote := models.QuoteCombinedGold(rules, models.CombinedGoldInput{UnitMonthlyMinor: 300_000, ProfileCount: 3, Interval: "month", TierAllowed: true})
	weaker, applied := models.ApplyOfferWhenItBeatsTheQuote(quote.AsPriceQuote(), models.OfferTerms{Kind: models.OfferPercentage, PercentOff: 10}, "NGN")
	if applied || weaker.AmountMinor != 792_000 || weaker.DiscountKind != models.DiscountKindMultiBusiness {
		t.Fatalf("a 10%% offer loses to the 12%% tier: %+v", weaker)
	}
	stronger, applied := models.ApplyOfferWhenItBeatsTheQuote(quote.AsPriceQuote(), models.OfferTerms{Kind: models.OfferPercentage, PercentOff: 30}, "NGN")
	if !applied || stronger.AmountMinor != 630_000 {
		t.Fatalf("a 30%% offer replaces the tier instead of stacking: %+v", stronger)
	}
	charge := models.CombinedGoldCharge(quote, stronger, 0)
	if charge.AmountDueMinor != 630_000 || len(charge.LineItems) != 2 || charge.LineItems[1].Kind != models.LineItemOfferDiscount {
		t.Fatalf("offer charge: %+v", charge)
	}
}
