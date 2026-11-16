package sellerreserves_test

import (
	"context"
	"math"
	"testing"
	"time"

	"nantty/modules/ledger/src/databases"
	"nantty/modules/ledger/src/modules/sellerReserves"
)

func TestReserveAmountRoundsHalfUpAndNeverExceedsTheRelease(t *testing.T) {
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
		if got := sellerreserves.ReserveAmount(testCase.available, testCase.bps); got != testCase.want {
			t.Fatalf("%+v: got %d", testCase, got)
		}
	}
}

func TestTermsComeFromTheRegisteredPolicy(t *testing.T) {
	if terms, err := sellerreserves.TermsFor(context.Background(), nil, "seller"); err != nil || terms.ReserveBps != 0 {
		t.Fatalf("no policy means no reserve: %+v %v", terms, err)
	}
	sellerreserves.RegisterPolicy(func(context.Context, databases.ExecutorQuerier, string) (sellerreserves.Terms, error) {
		return sellerreserves.Terms{ReserveBps: 2000, HoldFor: 30 * 24 * time.Hour}, nil
	})
	defer sellerreserves.RegisterPolicy(nil)
	if terms, _ := sellerreserves.TermsFor(context.Background(), nil, "seller"); terms.ReserveBps != 2000 || terms.HoldFor != 30*24*time.Hour {
		t.Fatalf("registered terms: %+v", terms)
	}
}
