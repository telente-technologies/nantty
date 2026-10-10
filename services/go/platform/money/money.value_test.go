package money

import (
	"encoding/json"
	"errors"
	"math"
	"testing"
)

func TestAddRejectsMismatchedCurrenciesAndOverflow(t *testing.T) {
	cases := []struct {
		name    string
		left    Money
		right   Money
		want    int64
		wantErr error
	}{
		{"same currency", Money{150, "NGN"}, Money{50, "NGN"}, 200, nil},
		{"mismatched currency", Money{150, "NGN"}, Money{50, "USD"}, 0, ErrCurrencyMismatch},
		{"overflow", Money{math.MaxInt64, "USD"}, Money{1, "USD"}, 0, ErrAmountOverflow},
		{"negative overflow", Money{math.MinInt64, "USD"}, Money{-1, "USD"}, 0, ErrAmountOverflow},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			got, err := testCase.left.Add(testCase.right)
			if !errors.Is(err, testCase.wantErr) {
				t.Fatalf("error = %v, want %v", err, testCase.wantErr)
			}
			if err == nil && got.AmountMinor != testCase.want {
				t.Fatalf("amount = %d, want %d", got.AmountMinor, testCase.want)
			}
		})
	}
}

func TestApplyBasisPointsRoundsHalfToEven(t *testing.T) {
	cases := []struct {
		amount      int64
		basisPoints int64
		want        int64
	}{
		{10_000, 250, 250},
		{50, 1_000, 5},
		{25, 2_000, 5},
		{5, 1_000, 0},
		{15, 1_000, 2},
		{-15, 1_000, -2},
	}
	for _, testCase := range cases {
		got, err := Money{testCase.amount, "GHS"}.ApplyBasisPointsRoundingHalfToEven(testCase.basisPoints)
		if err != nil || got.AmountMinor != testCase.want {
			t.Fatalf("%d x %d bps = %d (%v), want %d", testCase.amount, testCase.basisPoints, got.AmountMinor, err, testCase.want)
		}
	}
}

func TestMultiplyByQuantityRejectsOverflowForAllSigns(t *testing.T) {
	cases := []struct {
		name     string
		amount   int64
		quantity int64
		want     int64
		wantErr  error
	}{
		{"positive overflow", math.MaxInt64, 2, 0, ErrAmountOverflow},
		{"negative overflow", math.MinInt64, 2, 0, ErrAmountOverflow},
		{"negative times negative overflow", math.MinInt64, -1, 0, ErrAmountOverflow},
		{"negative times negative valid", -3, -4, 12, nil},
		{"zero quantity", math.MinInt64, 0, 0, nil},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			got, err := (Money{AmountMinor: testCase.amount, Currency: "USD"}).MultiplyByQuantity(testCase.quantity)
			if !errors.Is(err, testCase.wantErr) {
				t.Fatalf("error = %v, want %v", err, testCase.wantErr)
			}
			if err == nil && got.AmountMinor != testCase.want {
				t.Fatalf("amount = %d, want %d", got.AmountMinor, testCase.want)
			}
		})
	}
}

func TestApplyBasisPointsRejectsOverflowForAllSigns(t *testing.T) {
	cases := []struct {
		amount      int64
		basisPoints int64
	}{
		{math.MaxInt64, 2},
		{math.MinInt64, 2},
		{math.MinInt64, -1},
	}
	for _, testCase := range cases {
		if _, err := (Money{AmountMinor: testCase.amount, Currency: "USD"}).ApplyBasisPointsRoundingHalfToEven(testCase.basisPoints); !errors.Is(err, ErrAmountOverflow) {
			t.Fatalf("%d x %d bps error = %v, want %v", testCase.amount, testCase.basisPoints, err, ErrAmountOverflow)
		}
	}
}

func TestAllocateByWeightsKeepsEveryMinorUnit(t *testing.T) {
	cases := []struct {
		amount  int64
		weights []int64
		want    []int64
	}{
		{100, []int64{1, 1, 1}, []int64{34, 33, 33}},
		{1_000, []int64{70, 30}, []int64{700, 300}},
		{5, []int64{0, 1, 1}, []int64{0, 3, 2}},
		{-10, []int64{1, 2}, []int64{-4, -6}},
	}
	for _, testCase := range cases {
		shares, err := Money{testCase.amount, "KES"}.AllocateByWeightsWithoutLosingMinorUnits(testCase.weights)
		if err != nil {
			t.Fatal(err)
		}
		var total int64
		for index, share := range shares {
			total += share.AmountMinor
			if share.AmountMinor != testCase.want[index] {
				t.Fatalf("share %d = %d, want %d", index, share.AmountMinor, testCase.want[index])
			}
		}
		if total != testCase.amount {
			t.Fatalf("total %d != %d", total, testCase.amount)
		}
	}
}

func TestAllocateByWeightsHandlesExtremeAmountsAndWeights(t *testing.T) {
	cases := []struct {
		amount  int64
		weights []int64
		want    []int64
	}{
		{math.MaxInt64, []int64{math.MaxInt64, math.MaxInt64}, []int64{4_611_686_018_427_387_904, 4_611_686_018_427_387_903}},
		{math.MinInt64, []int64{math.MaxInt64, math.MaxInt64}, []int64{-4_611_686_018_427_387_904, -4_611_686_018_427_387_904}},
	}
	for _, testCase := range cases {
		shares, err := (Money{AmountMinor: testCase.amount, Currency: "USD"}).AllocateByWeightsWithoutLosingMinorUnits(testCase.weights)
		if err != nil {
			t.Fatal(err)
		}
		var total int64
		for index, share := range shares {
			if share.AmountMinor != testCase.want[index] {
				t.Fatalf("share %d = %d, want %d", index, share.AmountMinor, testCase.want[index])
			}
			total += share.AmountMinor
		}
		if total != testCase.amount {
			t.Fatalf("total = %d, want %d", total, testCase.amount)
		}
	}
}

func TestMoneyJsonRequiresValidCurrency(t *testing.T) {
	var parsed Money
	if err := json.Unmarshal([]byte(`{"amountMinor":1200,"currency":"ZAR"}`), &parsed); err != nil || parsed.AmountMinor != 1200 {
		t.Fatalf("parse failed: %v %+v", err, parsed)
	}
	if err := json.Unmarshal([]byte(`{"amountMinor":1200,"currency":"zar"}`), &parsed); err == nil {
		t.Fatal("expected invalid currency error")
	}
	if err := json.Unmarshal([]byte(`{"currency":"ZAR"}`), &parsed); err == nil {
		t.Fatal("expected missing amount error")
	}
}
