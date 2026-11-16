package services_test

import (
	"math"
	"slices"
	"testing"

	"nantty/modules/wallet/src/generated/ent/withdrawal"
	"nantty/modules/wallet/src/modules/payouts/services"
)

func TestWithdrawalFitsAvailableBalance(t *testing.T) {
	cases := []struct {
		name      string
		available int64
		reserved  int64
		amount    int64
		want      bool
	}{
		{"within balance", 1_000, 200, 800, true},
		{"reservation exceeds balance", 100, 101, 1, false},
		{"amount exceeds remaining balance", 100, 40, 61, false},
		{"exact remaining balance", 100, 40, 60, true},
		{"negative balance", -1, 0, 1, false},
		{"negative reservation", 100, -1, 1, false},
		{"nonpositive amount", 100, 0, 0, false},
		{"extreme reservation", math.MaxInt64, math.MaxInt64, 1, false},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			if got := services.WithdrawalFitsAvailableBalance(testCase.available, testCase.reserved, testCase.amount); got != testCase.want {
				t.Fatalf("withdrawalFitsAvailableBalance(%d, %d, %d) = %t, want %t", testCase.available, testCase.reserved, testCase.amount, got, testCase.want)
			}
		})
	}
}

func TestAProcessingWithdrawalIsSubtractedWhenNewWithdrawalsMayStartDuringIt(t *testing.T) {
	if slices.Contains(services.StatusesToSubtractFromProviderBalance(true), withdrawal.StatusProcessing) {
		t.Fatal("with the processing block on, a processing withdrawal already refuses new ones")
	}
	allowed := services.StatusesToSubtractFromProviderBalance(false)
	for _, status := range []withdrawal.Status{withdrawal.StatusPendingReview, withdrawal.StatusOnHold, withdrawal.StatusQueued, withdrawal.StatusProcessing} {
		if !slices.Contains(allowed, status) {
			t.Fatalf("%s must be subtracted from the provider balance when the block is off", status)
		}
	}
}
