package models

import (
	"errors"
	"math"
	"testing"
)

func TestCoinTransferRoundsDownForTheRecipientAndTheFeeTakesTheRemainder(t *testing.T) {
	cases := []struct {
		coins, feeBps, fee, net int64
		err                     error
	}{
		{100, 2500, 25, 75, nil}, {1, 2500, 0, 0, ErrTransferTooSmallForFee}, {2, 2500, 1, 1, nil}, {3, 2500, 1, 2, nil},
		{7, 2500, 2, 5, nil}, {10, 0, 0, 10, nil}, {math.MaxInt64, 2500, 2_305_843_009_213_693_952, 6_917_529_027_641_081_855, nil},
		{0, 2500, 0, 0, ErrCoinAmountOutOfRange}, {-4, 2500, 0, 0, ErrCoinAmountOutOfRange}, {10, 10_000, 0, 0, ErrCoinAmountOutOfRange},
	}
	for _, testCase := range cases {
		split, err := SplitCoinTransfer(testCase.coins, testCase.feeBps)
		if !errors.Is(err, testCase.err) {
			t.Errorf("%d coins: err %v want %v", testCase.coins, err, testCase.err)
			continue
		}
		if err == nil && (split.FeeCoins != testCase.fee || split.NetCoins != testCase.net || split.FeeCoins+split.NetCoins != testCase.coins) {
			t.Errorf("%d coins: %+v", testCase.coins, split)
		}
	}
}

func TestCoinsToCashConversionIsOverflowChecked(t *testing.T) {
	if cash, err := ConvertCoinsToCashMinor(180, 1000); err != nil || cash != 180_000 {
		t.Fatalf("180 coins = %d %v", cash, err)
	}
	for _, testCase := range [][2]int64{{math.MaxInt64, 2}, {0, 1000}, {5, 0}, {-1, 10}} {
		if _, err := ConvertCoinsToCashMinor(testCase[0], testCase[1]); err == nil {
			t.Errorf("%v accepted", testCase)
		}
	}
}

func TestPackagePriceFallsBackToUsdOnlyWhenTheViewerCurrencyCannotBeCharged(t *testing.T) {
	prices := map[string]int64{"NGN": 150_000, "USD": 99, "GBP": 79}
	chargeable := func(currency string) bool { return currency != "GBP" }
	cases := map[string]ChosenPrice{"NGN": {"NGN", 150_000}, "GBP": {"USD", 99}, "KES": {"USD", 99}}
	for preferred, want := range cases {
		if got, err := ChooseCoinPackagePrice(prices, preferred, chargeable); err != nil || got != want {
			t.Errorf("%s: got %+v %v", preferred, got, err)
		}
	}
	if _, err := ChooseCoinPackagePrice(map[string]int64{"GBP": 79}, "GBP", chargeable); !errors.Is(err, ErrNoPriceForCurrency) {
		t.Errorf("expected no price, got %v", err)
	}
}

func TestClawbackRecoversWhatIsLeftAndCountsTheShortfall(t *testing.T) {
	cases := []struct{ balance, purchased, recovered, shortfall int64 }{{500, 100, 100, 0}, {40, 100, 40, 60}, {0, 100, 0, 100}, {-5, 100, 0, 100}}
	for _, testCase := range cases {
		got := SplitCoinClawback(testCase.balance, testCase.purchased)
		if got.RecoveredCoins != testCase.recovered || got.ShortfallCoins != testCase.shortfall {
			t.Errorf("%+v: got %+v", testCase, got)
		}
	}
}
