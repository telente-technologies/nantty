package models

import (
	"math"
	"testing"
)

func TestEscrowTransitionsFollowTheAllowList(t *testing.T) {
	cases := []struct {
		from, to EscrowStatus
		allowed  bool
	}{
		{EscrowHeld, EscrowReleased, true}, {EscrowHeld, EscrowDisputed, true}, {EscrowHeld, EscrowRefunded, true},
		{EscrowDisputed, EscrowReleased, true}, {EscrowDisputed, EscrowHeld, true}, {EscrowDisputed, EscrowPartiallyRefunded, true},
		{EscrowReleased, EscrowRefunded, true}, {EscrowRefunded, EscrowReleased, false}, {EscrowReleased, EscrowDisputed, false},
		{EscrowPartiallyRefunded, EscrowReleased, false}, {EscrowHeld, EscrowHeld, false},
	}
	for _, testCase := range cases {
		if got := EscrowTransitionIsAllowed(testCase.from, testCase.to); got != testCase.allowed {
			t.Errorf("%s -> %s: got %v", testCase.from, testCase.to, got)
		}
	}
}

func TestSplitRoundsDownForTheSellerAndAlwaysSumsToTheAmount(t *testing.T) {
	cases := []struct {
		amount, bps, seller, commission int64
	}{
		{10_000, 500, 9_500, 500}, {1, 500, 1, 0}, {19, 500, 19, 0}, {101, 500, 96, 5}, {0, 500, 0, 0},
		{12_345, 0, 12_345, 0}, {12_345, 10_000, 0, 12_345}, {math.MaxInt64, 500, 8_762_203_435_012_037_017, 461_168_601_842_738_790},
	}
	for _, testCase := range cases {
		split, err := SplitAmountBetweenSellerAndPlatform(testCase.amount, testCase.bps)
		if err != nil || split.SellerAmountMinor != testCase.seller || split.CommissionMinor != testCase.commission {
			t.Errorf("%d at %d bps: %+v %v", testCase.amount, testCase.bps, split, err)
		}
		if split.SellerAmountMinor+split.CommissionMinor != testCase.amount {
			t.Errorf("split of %d does not sum", testCase.amount)
		}
	}
	for _, bps := range []int64{-1, 10_001} {
		if _, err := SplitAmountBetweenSellerAndPlatform(100, bps); err == nil {
			t.Errorf("bps %d accepted", bps)
		}
	}
}

func TestPartialResolutionSplitsTheReleasedRemainder(t *testing.T) {
	resolution, err := SplitPartialResolution(10_000, 2_500, 500)
	if err != nil || resolution.RefundMinor+resolution.SellerMinor+resolution.CommissionMinor != 10_000 || resolution.SellerMinor != 7_125 || resolution.CommissionMinor != 375 {
		t.Fatalf("resolution = %+v %v", resolution, err)
	}
	for _, refund := range []int64{0, -5, 10_000, 10_001} {
		if _, err := SplitPartialResolution(10_000, refund, 500); err == nil {
			t.Errorf("refund %d accepted", refund)
		}
	}
}
