package services

import "testing"

func TestSellerReserveAmountRoundsHalfUpAndNeverExceedsTheRelease(t *testing.T) {
	cases := []struct {
		available, bps, want int64
	}{
		{100_000, 1000, 10_000},
		{12_345, 1000, 1_235},
		{100, 20_000, 100},
		{0, 1000, 0},
		{50_000, 0, 0},
	}
	for _, testCase := range cases {
		if got := SellerReserveAmount(testCase.available, testCase.bps); got != testCase.want {
			t.Fatalf("%+v: got %d", testCase, got)
		}
	}
}
