package services_test

import (
	"testing"
	"time"

	"nantty/modules/ads/src/services"
)

func TestSplitUsesFortyPercentForOriginalAndTwelveForAiContent(t *testing.T) {
	original := services.SplitRevenueBetweenCreatorAndPlatform(1_000_000, 4_000, 10_000, true)
	if original.CreatorMicros != 400_000 || original.PlatformMicros != 600_000 {
		t.Fatalf("original content should share 40%%, got %+v", original)
	}
	ai := services.SplitRevenueBetweenCreatorAndPlatform(1_000_000, 4_000, 3_000, true)
	if ai.CreatorMicros != 120_000 || ai.PlatformMicros != 880_000 {
		t.Fatalf("ai content multiplier 0.30 applies to the normal share: 40%% to 12%%, got %+v", ai)
	}
}

func TestSplitNeverLosesMicrosAndRoundsHalfToEven(t *testing.T) {
	for _, charge := range []int64{1, 3, 7, 12_345, 999_999, 1_000_001} {
		split := services.SplitRevenueBetweenCreatorAndPlatform(charge, 4_000, 3_000, true)
		if split.CreatorMicros+split.PlatformMicros != charge {
			t.Fatalf("split must conserve %d, got %+v", charge, split)
		}
	}
	if got := services.SplitRevenueBetweenCreatorAndPlatform(25, 5_000, 10_000, true).CreatorMicros; got != 12 {
		t.Fatalf("12.5 rounds to the even 12, got %d", got)
	}
	if got := services.SplitRevenueBetweenCreatorAndPlatform(35, 5_000, 10_000, true).CreatorMicros; got != 18 {
		t.Fatalf("17.5 rounds to the even 18, got %d", got)
	}
}

func TestSplitSendsEverythingToPlatformWhenCreatorIsIneligibleOrAbsent(t *testing.T) {
	split := services.SplitRevenueBetweenCreatorAndPlatform(500_000, 4_000, 10_000, false)
	if split.CreatorMicros != 0 || split.PlatformMicros != 500_000 {
		t.Fatalf("unexpected %+v", split)
	}
	if split := services.SplitRevenueBetweenCreatorAndPlatform(0, 4_000, 10_000, true); split.ChargeMicros != 0 || split.CreatorMicros != 0 {
		t.Fatalf("zero charge splits to zero, got %+v", split)
	}
}

func TestResolveCreatorSharePrefersLatestEffectiveRowAndFallsBackToDefaults(t *testing.T) {
	now := time.Date(2026, 10, 3, 0, 0, 0, 0, time.UTC)
	past, ended, future := now.AddDate(0, -2, 0), now.AddDate(0, -1, 0), now.AddDate(0, 1, 0)
	rows := []services.MonetizationPolicyRow{
		{ContentType: services.ContentTypeOriginal, CreatorShareBps: 3_000, MultiplierBps: 10_000, EffectiveFrom: past},
		{ContentType: services.ContentTypeOriginal, CreatorShareBps: 4_500, MultiplierBps: 10_000, EffectiveFrom: now.AddDate(0, 0, -1)},
		{ContentType: services.ContentTypeOriginal, CreatorShareBps: 9_000, MultiplierBps: 10_000, EffectiveFrom: future},
		{ContentType: services.ContentTypeAiGenerated, CreatorShareBps: 4_000, MultiplierBps: 2_500, EffectiveFrom: past, EffectiveTo: &ended},
	}
	if share, multiplier := services.ResolveCreatorShare(rows, false, now); share != 4_500 || multiplier != 10_000 {
		t.Fatalf("expected the latest effective original row, got %d %d", share, multiplier)
	}
	if share, multiplier := services.ResolveCreatorShare(rows, true, now); share != services.DefaultCreatorShareBps || multiplier != services.DefaultAiMultiplierBps {
		t.Fatalf("expired ai row should fall back to defaults, got %d %d", share, multiplier)
	}
}

func TestPremiumPoolAllocationSumsExactlyAndIgnoresNonConsumers(t *testing.T) {
	allocations, err := services.AllocatePremiumPoolByConsumption(1_000, "NGN", []services.ConsumptionWeight{
		{CreatorUserId: "b", WatchSeconds: 300},
		{CreatorUserId: "a", WatchSeconds: 100},
		{CreatorUserId: "c", WatchSeconds: 0},
		{CreatorUserId: "d", WatchSeconds: 600},
	})
	if err != nil || len(allocations) != 3 {
		t.Fatalf("unexpected %+v %v", allocations, err)
	}
	var sum int64
	for _, allocation := range allocations {
		sum += allocation.AmountMinor
	}
	if sum != 1_000 || allocations[0].CreatorUserId != "a" || allocations[0].AmountMinor != 100 || allocations[2].AmountMinor != 600 {
		t.Fatalf("allocation must be proportional and exact, got %+v", allocations)
	}
}

func TestWholeMinorUnitsAndCarryKeepsFractionsForTheNextBatch(t *testing.T) {
	minor, carry := services.WholeMinorUnitsAndCarry(2_750_000)
	if minor != 2 || carry != 750_000 {
		t.Fatalf("got %d %d", minor, carry)
	}
}
