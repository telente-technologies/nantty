package services

import "testing"

func TestPausedCreatorsShareGoesToThePlatform(t *testing.T) {
	byUser := map[string]int64{"paused": 3_000, "active": 2_000}
	impressions := map[string]int64{"paused": 3, "active": 2}
	creator, platform := ExcludePausedCreatorsFromTotals(5_000, 7_000, byUser, impressions, map[string]bool{"paused": true})
	if creator != 2_000 || platform != 10_000 {
		t.Fatalf("creator %d platform %d", creator, platform)
	}
	if _, found := byUser["paused"]; found || impressions["active"] != 2 {
		t.Fatal("the paused creator gets no earnings row; others keep theirs")
	}
	if creator+platform != 12_000 {
		t.Fatal("totals are conserved")
	}
}

func TestPausedCreatorsAreLeftOutOfThePremiumPool(t *testing.T) {
	weights := []ConsumptionWeight{{CreatorUserId: "a", WatchSeconds: 10}, {CreatorUserId: "b", WatchSeconds: 20}}
	kept := ExcludePausedCreatorsFromConsumption(weights, map[string]bool{"b": true})
	if len(kept) != 1 || kept[0].CreatorUserId != "a" {
		t.Fatalf("kept %v", kept)
	}
	allocations, err := AllocatePremiumPoolByConsumption(1_000, "NGN", kept)
	if err != nil || len(allocations) != 1 || allocations[0].AmountMinor != 1_000 {
		t.Fatalf("the whole pool goes to eligible creators: %v %v", allocations, err)
	}
}
