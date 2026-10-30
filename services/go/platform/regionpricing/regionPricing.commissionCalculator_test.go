package regionpricing

import (
	"errors"
	"math"
	"testing"
)

func TestGrossUpForFeesUsesExactMinorUnitsAndPricePoint(t *testing.T) {
	got, err := GrossUpForFees(1_000, 0, []int64{1_500}, "USD")
	if err != nil {
		t.Fatal(err)
	}
	if got != 1_199 {
		t.Fatalf("gross-up=%d, want 1199 minor units after configured USD price-point rounding", got)
	}
	if got-got*1_500/10_000 < 1_000 {
		t.Fatalf("rounded price %d does not preserve the net target", got)
	}
}

func TestGrossUpForFeesCombinesSameBaseRatesAndFixedFee(t *testing.T) {
	got, err := GrossUpForFees(10_000, 100, []int64{1_000, 500}, "NGN")
	if err != nil {
		t.Fatal(err)
	}
	if got != 20_000 {
		t.Fatalf("gross-up=%d, want 20000 minor units after NGN price-point rounding", got)
	}
}

func TestGrossUpForFeesRejectsInvalidInputs(t *testing.T) {
	tests := []struct {
		name       string
		net, fixed int64
		rates      []int64
		wantErr    error
	}{
		{name: "zero target", net: 0, wantErr: ErrInvalidPriceTarget},
		{name: "negative fixed fee", net: 1, fixed: -1, wantErr: ErrInvalidFixedFee},
		{name: "negative rate", net: 1, rates: []int64{-1}, wantErr: ErrInvalidFeeRate},
		{name: "rate at one hundred percent", net: 1, rates: []int64{10_000}, wantErr: ErrInvalidFeeRate},
		{name: "combined rates at one hundred percent", net: 1, rates: []int64{6_000, 4_000}, wantErr: ErrInvalidFeeRate},
		{name: "overflow", net: math.MaxInt64 - 1_000, wantErr: ErrPriceOverflow},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			_, err := GrossUpForFees(test.net, test.fixed, test.rates, "USD")
			if !errors.Is(err, test.wantErr) {
				t.Fatalf("error=%v, want %v", err, test.wantErr)
			}
		})
	}
}
