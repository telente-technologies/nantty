package money

import (
	"encoding/json"
	"errors"
	"math"
	"testing"
)

func TestParseMajorUnitsAcceptsExactAmounts(t *testing.T) {
	cases := []struct {
		text     string
		currency string
		want     int64
	}{
		{"2000", "NGN", 200000},
		{"2000.5", "NGN", 200050},
		{"2,000.00", "NGN", 200000},
		{"1,234,567.89", "NGN", 123456789},
		{"0.01", "NGN", 1},
		{"0", "NGN", 0},
		{" 10.75 ", "NGN", 1075},
		{"100.000", "NGN", 10000},
		{"1500", "UGX", 1500},
		{"1500.0", "UGX", 1500},
		{"1.234", "KWD", 1234},
		{"92233720368547758.07", "NGN", math.MaxInt64},
		{"007.10", "GHS", 710},
	}
	for _, testCase := range cases {
		got, err := ParseMajorUnits(testCase.text, testCase.currency)
		if err != nil || got != testCase.want {
			t.Errorf("ParseMajorUnits(%q, %s) = %d, %v; want %d", testCase.text, testCase.currency, got, err, testCase.want)
		}
	}
}

func TestParseMajorUnitsRejectsAnythingInexact(t *testing.T) {
	cases := []struct {
		text     string
		currency string
		want     error
	}{
		{"", "NGN", ErrInvalidDecimalAmount},
		{"-1.00", "NGN", ErrNegativeAmount},
		{"-0", "NGN", ErrNegativeAmount},
		{"+1", "NGN", ErrInvalidDecimalAmount},
		{"1e3", "NGN", ErrInvalidDecimalAmount},
		{"1.", "NGN", ErrInvalidDecimalAmount},
		{".5", "NGN", ErrInvalidDecimalAmount},
		{"1.2.3", "NGN", ErrInvalidDecimalAmount},
		{"1 000", "NGN", ErrInvalidDecimalAmount},
		{"2,00.00", "NGN", ErrInvalidDecimalAmount},
		{"1,2345", "NGN", ErrInvalidDecimalAmount},
		{",100", "NGN", ErrInvalidDecimalAmount},
		{"1000,000", "NGN", ErrInvalidDecimalAmount},
		{"1.00,5", "NGN", ErrInvalidDecimalAmount},
		{"10.755", "NGN", ErrTooManyFractionDigits},
		{"0.001", "NGN", ErrTooManyFractionDigits},
		{"1500.5", "UGX", ErrTooManyFractionDigits},
		{"NaN", "NGN", ErrInvalidDecimalAmount},
		{"Infinity", "NGN", ErrInvalidDecimalAmount},
		{"0x10", "NGN", ErrInvalidDecimalAmount},
		{"١٢٣", "NGN", ErrInvalidDecimalAmount},
		{"92233720368547758.08", "NGN", ErrAmountOverflow},
		{"99999999999999999999999", "NGN", ErrAmountOverflow},
		{"10", "ngn", ErrInvalidCurrencyCode},
	}
	for _, testCase := range cases {
		got, err := ParseMajorUnits(testCase.text, testCase.currency)
		if !errors.Is(err, testCase.want) {
			t.Errorf("ParseMajorUnits(%q, %s) = %d, %v; want %v", testCase.text, testCase.currency, got, err, testCase.want)
		}
	}
}

func TestParseMajorUnitsFromJsonNeverUsesFloats(t *testing.T) {
	accepted := map[string]int64{`"2,000.00"`: 200000, `2000.10`: 200010, `10.75`: 1075, `0.07`: 7, `"12"`: 1200}
	for raw, want := range accepted {
		got, err := ParseMajorUnitsFromJson(json.RawMessage(raw), "NGN")
		if err != nil || got != want {
			t.Errorf("ParseMajorUnitsFromJson(%s) = %d, %v; want %d", raw, got, err, want)
		}
	}
	for _, raw := range []string{`null`, ``, `1e2`, `1E2`, `-5`, `true`, `"abc"`, `{}`, `[1]`, `0.1e1`} {
		if got, err := ParseMajorUnitsFromJson(json.RawMessage(raw), "NGN"); err == nil {
			t.Errorf("ParseMajorUnitsFromJson(%s) = %d; want an error", raw, got)
		}
	}
}

func TestFormatMajorUnitsRoundTrips(t *testing.T) {
	cases := map[int64]string{0: "0.00", 1: "0.01", 10: "0.10", 200050: "2000.50", -7: "-0.07", math.MaxInt64: "92233720368547758.07", math.MinInt64: "-92233720368547758.08"}
	for minor, want := range cases {
		got, err := FormatMajorUnits(minor, "NGN")
		if err != nil || got != want {
			t.Errorf("FormatMajorUnits(%d) = %q, %v; want %q", minor, got, err, want)
		}
		if minor >= 0 {
			if parsed, err := ParseMajorUnits(got, "NGN"); err != nil || parsed != minor {
				t.Errorf("round trip %d -> %q -> %d, %v", minor, got, parsed, err)
			}
		}
	}
	if got, _ := FormatMajorUnits(1500, "UGX"); got != "1500" {
		t.Errorf("UGX format = %q", got)
	}
	if got, _ := FormatMajorUnits(1234, "KWD"); got != "1.234" {
		t.Errorf("KWD format = %q", got)
	}
}
