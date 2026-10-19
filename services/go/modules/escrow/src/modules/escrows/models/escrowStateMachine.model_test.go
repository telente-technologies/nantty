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
		{EscrowReleased, EscrowRefunded, true}, {EscrowReleased, EscrowClawedBack, true}, {EscrowRefunded, EscrowReleased, false}, {EscrowReleased, EscrowDisputed, false},
		{EscrowPartiallyRefunded, EscrowReleased, false}, {EscrowPartiallyRefunded, EscrowRefunded, true}, {EscrowPartiallyRefunded, EscrowPartiallyRefunded, false}, {EscrowHeld, EscrowHeld, false},
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

func TestCommissionOnARemainderIsTheHeldCommissionProRataWithTheDustToTheSeller(t *testing.T) {
	cases := []struct {
		heldCommission, amount, remainder, kept int64
	}{
		{2_000, 1_000_000, 333_333, 666}, {150, 10_000, 7_500, 112}, {0, 10_000, 5_000, 0}, {150, 10_000, 10_000, 150}, {150, 10_000, 0, 0},
		{math.MaxInt64 / 2, math.MaxInt64, math.MaxInt64 / 3, 1_537_228_672_809_129_300},
	}
	for _, testCase := range cases {
		if kept := CommissionKeptOnRemainder(testCase.heldCommission, testCase.amount, testCase.remainder); kept != testCase.kept {
			t.Errorf("%d of %d on a %d remainder: kept %d, want %d", testCase.heldCommission, testCase.amount, testCase.remainder, kept, testCase.kept)
		}
	}
	if kept := CommissionKeptOnRemainder(150, 0, 100); kept != 0 {
		t.Errorf("a zero amount keeps no commission: %d", kept)
	}
}
