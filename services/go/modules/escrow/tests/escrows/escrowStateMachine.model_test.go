package escrows_test

import (
	"math"
	"testing"

	"nantty/modules/escrow/src/modules/escrows/models"
)

func TestEscrowTransitionsFollowTheAllowList(t *testing.T) {
	cases := []struct {
		from, to models.EscrowStatus
		allowed  bool
	}{
		{models.EscrowHeld, models.EscrowReleased, true}, {models.EscrowHeld, models.EscrowDisputed, true}, {models.EscrowHeld, models.EscrowRefunded, true},
		{models.EscrowDisputed, models.EscrowReleased, true}, {models.EscrowDisputed, models.EscrowHeld, true}, {models.EscrowDisputed, models.EscrowPartiallyRefunded, true},
		{models.EscrowReleased, models.EscrowRefunded, true}, {models.EscrowReleased, models.EscrowClawedBack, true}, {models.EscrowRefunded, models.EscrowReleased, false}, {models.EscrowReleased, models.EscrowDisputed, false},
		{models.EscrowPartiallyRefunded, models.EscrowReleased, false}, {models.EscrowPartiallyRefunded, models.EscrowRefunded, true}, {models.EscrowPartiallyRefunded, models.EscrowPartiallyRefunded, false}, {models.EscrowHeld, models.EscrowHeld, false},
	}
	for _, testCase := range cases {
		if got := models.EscrowTransitionIsAllowed(testCase.from, testCase.to); got != testCase.allowed {
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
		split, err := models.SplitAmountBetweenSellerAndPlatform(testCase.amount, testCase.bps)
		if err != nil || split.SellerAmountMinor != testCase.seller || split.CommissionMinor != testCase.commission {
			t.Errorf("%d at %d bps: %+v %v", testCase.amount, testCase.bps, split, err)
		}
		if split.SellerAmountMinor+split.CommissionMinor != testCase.amount {
			t.Errorf("split of %d does not sum", testCase.amount)
		}
	}
	for _, bps := range []int64{-1, 10_001} {
		if _, err := models.SplitAmountBetweenSellerAndPlatform(100, bps); err == nil {
			t.Errorf("bps %d accepted", bps)
		}
	}
}

func TestPartialResolutionSplitsTheReleasedRemainder(t *testing.T) {
	resolution, err := models.SplitPartialResolution(10_000, 2_500, 500)
	if err != nil || resolution.RefundMinor+resolution.SellerMinor+resolution.CommissionMinor != 10_000 || resolution.SellerMinor != 7_125 || resolution.CommissionMinor != 375 {
		t.Fatalf("resolution = %+v %v", resolution, err)
	}
	for _, refund := range []int64{0, -5, 10_000, 10_001} {
		if _, err := models.SplitPartialResolution(10_000, refund, 500); err == nil {
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
		if kept := models.CommissionKeptOnRemainder(testCase.heldCommission, testCase.amount, testCase.remainder); kept != testCase.kept {
			t.Errorf("%d of %d on a %d remainder: kept %d, want %d", testCase.heldCommission, testCase.amount, testCase.remainder, kept, testCase.kept)
		}
	}
	if kept := models.CommissionKeptOnRemainder(150, 0, 100); kept != 0 {
		t.Errorf("a zero amount keeps no commission: %d", kept)
	}
}
