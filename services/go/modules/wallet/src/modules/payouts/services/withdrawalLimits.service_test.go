package services

import (
	"testing"

	"nantty/modules/wallet/src/configs"
)

func TestNameMatchedOnlyBankGetsTheReducedDailyCap(t *testing.T) {
	limits := configs.WithdrawalLimits{
		DailyCapMinor:                configs.ParseLevelCurrencyCaps("1:NGN:50000000,2:NGN:500000000"),
		NameMatchedOnlyDailyCapMinor: configs.ParseCurrencyCaps("NGN:10000000"),
	}
	if amount, _ := effectiveWithdrawalDailyCap(limits, 1, "NGN", false); amount != 50_000_000 {
		t.Fatalf("a BVN-validated Level 1 keeps the full cap, got %d", amount)
	}
	if amount, capped := effectiveWithdrawalDailyCap(limits, 1, "NGN", true); !capped || amount != 10_000_000 {
		t.Fatalf("a name-matched-only Level 1 is capped at 100000 NGN, got %d %v", amount, capped)
	}
	if amount, _ := effectiveWithdrawalDailyCap(limits, 2, "NGN", true); amount != 500_000_000 {
		t.Fatalf("a name-matched-only flag without the Level 1 gate must not lower a Level 2 cap, got %d", amount)
	}
}

func TestNameMatchedOnlyCapFallsBackToTheDefaultAndNeverRaisesTheCap(t *testing.T) {
	defaults := configs.WithdrawalLimits{}
	if amount, capped := effectiveWithdrawalDailyCap(defaults, 1, "NGN", true); !capped || amount != 10_000_000 {
		t.Fatalf("default name-matched-only cap: %d %v, want 10000000 NGN minor units", amount, capped)
	}
	noReduction := configs.WithdrawalLimits{
		DailyCapMinor:                configs.ParseLevelCurrencyCaps("1:NGN:5000000"),
		NameMatchedOnlyDailyCapMinor: configs.ParseCurrencyCaps("NGN:50000000"),
	}
	if amount, _ := effectiveWithdrawalDailyCap(noReduction, 1, "NGN", true); amount != 5_000_000 {
		t.Fatalf("the reduced cap must never raise the daily cap, got %d", amount)
	}
}
