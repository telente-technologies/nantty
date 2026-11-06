package models

import (
	"errors"
	"math"
	"testing"
)

func TestSpaceDonationSplitValidatesBoundsAndBalancesExactAmount(t *testing.T) {
	for _, test := range []struct {
		coins, share, minimum, maximum, creator, platform int64
	}{
		{5, 5000, 5, 80, 2, 3},
		{51, 5000, 5, 80, 25, 26},
		{80, 7000, 5, 80, 56, 24},
	} {
		split, err := SplitSpaceDonationCoins(test.coins, test.share, test.minimum, test.maximum)
		if err != nil || split.TotalCoins != test.coins || split.CreatorAmountCoins != test.creator || split.PlatformFeeCoins != test.platform || split.TotalCoins != split.CreatorAmountCoins+split.PlatformFeeCoins {
			t.Errorf("split(%d, %d) = %+v, %v", test.coins, test.share, split, err)
		}
	}
	for _, test := range [][3]int64{{0, 1, 80}, {4, 5, 80}, {81, 5, 80}, {1, 0, 80}, {1, 1, math.MaxInt64}, {math.MaxInt64, 1, math.MaxInt64}} {
		if _, err := SplitSpaceDonationCoins(test[0], 5000, test[1], test[2]); !errors.Is(err, ErrInvalidDonation) {
			t.Errorf("invalid donation tuple %v returned %v", test, err)
		}
	}
}

func TestSplitCoinsByPlatformFeeBpsUsesConfiguredFeeAndValidatesBounds(t *testing.T) {
	for _, test := range []struct {
		coins, feeBps, recipient, platform int64
	}{
		{1, 200, 1, 0},
		{51, 200, 50, 1},
		{100, 200, 98, 2},
		{100, 10_000, 0, 100},
		{math.MaxInt64, 200, math.MaxInt64 - math.MaxInt64/50, math.MaxInt64 / 50},
	} {
		split, err := SplitCoinsByPlatformFeeBps(test.coins, test.feeBps)
		if err != nil || split.TotalCoins != test.coins || split.CreatorAmountCoins != test.recipient || split.PlatformFeeCoins != test.platform || split.TotalCoins != split.CreatorAmountCoins+split.PlatformFeeCoins {
			t.Errorf("split(%d, %d) = %+v, %v", test.coins, test.feeBps, split, err)
		}
	}
	for _, test := range []struct{ coins, feeBps int64 }{{0, 200}, {-1, 200}, {1, -1}, {1, 10_001}} {
		if _, err := SplitCoinsByPlatformFeeBps(test.coins, test.feeBps); err == nil {
			t.Errorf("invalid split(%d, %d) accepted", test.coins, test.feeBps)
		}
	}
}
