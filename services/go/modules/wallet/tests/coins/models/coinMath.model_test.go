package models_test

import (
	"errors"
	"math"
	"testing"

	"nantty/modules/wallet/src/modules/coins/models"
)

func TestCoinTransferRoundsDownForTheRecipientAndTheFeeTakesTheRemainder(t *testing.T) {
	cases := []struct {
		coins, feeBps, fee, net int64
		err                     error
	}{
		{100, 2500, 25, 75, nil}, {1, 2500, 0, 0, models.ErrTransferTooSmallForFee}, {2, 2500, 1, 1, nil}, {3, 2500, 1, 2, nil},
		{7, 2500, 2, 5, nil}, {10, 0, 0, 10, nil}, {math.MaxInt64, 2500, 2_305_843_009_213_693_952, 6_917_529_027_641_081_855, nil},
		{0, 2500, 0, 0, models.ErrCoinAmountOutOfRange}, {-4, 2500, 0, 0, models.ErrCoinAmountOutOfRange}, {10, 10_000, 0, 0, models.ErrCoinAmountOutOfRange},
	}
	for _, testCase := range cases {
		split, err := models.SplitCoinTransfer(testCase.coins, testCase.feeBps)
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
	if cash, err := models.ConvertCoinsToCashMinor(180, 1000); err != nil || cash != 180_000 {
		t.Fatalf("180 coins = %d %v", cash, err)
	}
	for _, testCase := range [][2]int64{{math.MaxInt64, 2}, {0, 1000}, {5, 0}, {-1, 10}} {
		if _, err := models.ConvertCoinsToCashMinor(testCase[0], testCase[1]); err == nil {
			t.Errorf("%v accepted", testCase)
		}
	}
}

func TestPackagePriceFallsBackToUsdOnlyWhenTheViewerCurrencyCannotBeCharged(t *testing.T) {
	prices := map[string]int64{"NGN": 150_000, "USD": 99, "GBP": 79}
	chargeable := func(currency string) bool { return currency != "GBP" }
	cases := map[string]models.ChosenPrice{"NGN": {"NGN", 150_000}, "GBP": {"USD", 99}, "KES": {"USD", 99}}
	for preferred, want := range cases {
		if got, err := models.ChooseCoinPackagePrice(prices, preferred, chargeable); err != nil || got != want {
			t.Errorf("%s: got %+v %v", preferred, got, err)
		}
	}
	if _, err := models.ChooseCoinPackagePrice(map[string]int64{"GBP": 79}, "GBP", chargeable); !errors.Is(err, models.ErrNoPriceForCurrency) {
		t.Errorf("expected no price, got %v", err)
	}
}

func TestClawbackRecoversWhatIsLeftAndCountsTheShortfall(t *testing.T) {
	cases := []struct{ balance, purchased, recovered, shortfall int64 }{{500, 100, 100, 0}, {40, 100, 40, 60}, {0, 100, 0, 100}, {-5, 100, 0, 100}}
	for _, testCase := range cases {
		got := models.SplitCoinClawback(testCase.balance, testCase.purchased)
		if got.RecoveredCoins != testCase.recovered || got.ShortfallCoins != testCase.shortfall {
			t.Errorf("%+v: got %+v", testCase, got)
		}
	}
}

func TestProportionalCoinChargebackUsesCumulativeFloorWithoutOverClawing(t *testing.T) {
	cases := []struct {
		amount, coins, price, want int64
	}{
		{1, 3, 2, 1},
		{1, 100, 300, 0},
		{150, 150, 300, 75},
		{299, 150, 300, 149},
		{300, 150, 300, 150},
		{math.MaxInt64 - 1, math.MaxInt64, math.MaxInt64, math.MaxInt64 - 1},
	}
	for _, testCase := range cases {
		got, err := models.ProportionalCoinChargeback(testCase.amount, testCase.coins, testCase.price)
		if err != nil || got != testCase.want {
			t.Errorf("proportionalCoinAmount(%d, %d, %d) = %d, %v; want %d", testCase.amount, testCase.coins, testCase.price, got, err, testCase.want)
		}
	}
	for _, testCase := range [][3]int64{{-1, 10, 10}, {1, 0, 10}, {1, 10, 0}, {11, 10, 10}} {
		if _, err := models.ProportionalCoinChargeback(testCase[0], testCase[1], testCase[2]); err == nil {
			t.Errorf("invalid ratio %v was accepted", testCase)
		}
	}
}

func TestPartialChargebackCoinTargetsAccumulateRemainders(t *testing.T) {
	coinTargets := []int64{}
	for _, cumulativeAmount := range []int64{1, 2, 3} {
		target, err := models.ProportionalCoinChargeback(cumulativeAmount, 2, 3)
		if err != nil {
			t.Fatal(err)
		}
		coinTargets = append(coinTargets, target)
	}
	if coinTargets[0] != 0 || coinTargets[1] != 1 || coinTargets[2] != 2 {
		t.Fatalf("cumulative targets lost fractional progress: %v", coinTargets)
	}
}

func TestWebPacksGiveMoreCoinsPerNairaWhileNettingTheSamePerCoin(t *testing.T) {
	cases := []struct {
		channelFeeBps int64
		want          int64
	}{{3000, 105}, {1500, 127}, {200, 147}}
	for _, testCase := range cases {
		coins, err := models.CoinsForChannelPrice(150_000, testCase.channelFeeBps, 1_000)
		if err != nil || coins != testCase.want {
			t.Errorf("fee %d: coins %d err %v, want %d", testCase.channelFeeBps, coins, err, testCase.want)
		}
	}
	if _, err := models.CoinsForChannelPrice(150_000, 10_000, 1_000); err == nil {
		t.Fatal("a 100% channel fee must be rejected")
	}
}
