package exchangeRates_test

import (
	"errors"
	"math"
	"testing"

	"nantty/modules/currency/src/modules/exchangeRates/services"
)

func TestParseDecimalRateToE8(t *testing.T) {
	cases := []struct {
		raw     string
		want    int64
		wantErr bool
	}{
		{"1550.25", 155_025_000_000, false}, {"0.79", 79_000_000, false}, {"1", 100_000_000, false}, {" 15.5 ", 1_550_000_000, false},
		{"0.00000001", 1, false}, {"0", 0, true}, {"0.0", 0, true}, {"-1", 0, true}, {"1.", 0, true}, {".5", 0, true},
		{"1.123456789", 0, true}, {"abc", 0, true}, {"1e3", 0, true}, {"99999999999", 0, true}, {"", 0, true},
	}
	for _, testCase := range cases {
		got, err := services.ParseDecimalRateToE8(testCase.raw)
		if (err != nil) != testCase.wantErr || got != testCase.want {
			t.Errorf("%q: got %d err=%v, want %d err=%v", testCase.raw, got, err, testCase.want, testCase.wantErr)
		}
	}
}

func TestFormatRoundTrips(t *testing.T) {
	for _, raw := range []string{"1", "1550.25", "0.79", "0.00000001", "15.5", "129"} {
		parsed, err := services.ParseDecimalRateToE8(raw)
		if err != nil || services.FormatE8AsDecimal(parsed) != raw {
			t.Errorf("%q round trip gave %q (%v)", raw, services.FormatE8AsDecimal(parsed), err)
		}
	}
}

func TestConvertMinorUnitsRoundsDownAndGuardsOverflow(t *testing.T) {
	usd, ngn, gbp := int64(100_000_000), int64(155_000_000_000), int64(79_000_000)
	cases := []struct {
		amount, from, to, want int64
		err                    error
	}{
		{100, usd, ngn, 155_000, nil}, {155_000, ngn, usd, 100, nil}, {1, ngn, usd, 0, nil}, {155_001, ngn, usd, 100, nil},
		{333, usd, gbp, 263, nil}, {0, usd, ngn, 0, nil}, {-1, usd, ngn, 0, services.ErrInvalidAmount}, {1, 0, ngn, 0, services.ErrInvalidRate},
		{math.MaxInt64, usd, ngn, 0, services.ErrAmountOverflow},
	}
	for _, testCase := range cases {
		got, err := services.ConvertMinorUnitsWithFloor(testCase.amount, testCase.from, testCase.to)
		if !errors.Is(err, testCase.err) || got != testCase.want {
			t.Errorf("%+v: got %d %v", testCase, got, err)
		}
	}
}

func TestExceedsChangeLimit(t *testing.T) {
	cases := []struct {
		current, proposed int64
		want              bool
	}{{100, 130, false}, {100, 131, true}, {100, 70, false}, {100, 69, true}, {155_000_000_000, 155_000_000_001, false}}
	for _, testCase := range cases {
		if services.ExceedsChangeLimit(testCase.current, testCase.proposed, 30) != testCase.want {
			t.Errorf("%+v", testCase)
		}
	}
}
