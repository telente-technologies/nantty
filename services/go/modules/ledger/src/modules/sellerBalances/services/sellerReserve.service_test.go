package services

import (
	"math"
	"testing"
)

func TestSellerReserveAmountRoundsHalfUpAndNeverExceedsTheRelease(t *testing.T) {
	cases := []struct {
		available, bps, want int64
	}{
		{100_000, 1000, 10_000},
		{12_345, 1000, 1_235},
		{100, 20_000, 100},
		{math.MaxInt64, 10_000, math.MaxInt64},
		{math.MaxInt64, 5_000, 4_611_686_018_427_387_904},
		{0, 1000, 0},
		{50_000, 0, 0},
	}
	for _, testCase := range cases {
		if got := SellerReserveAmount(testCase.available, testCase.bps); got != testCase.want {
			t.Fatalf("%+v: got %d", testCase, got)
		}
	}
}
