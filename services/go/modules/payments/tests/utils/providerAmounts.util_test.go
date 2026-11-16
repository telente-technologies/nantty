package utils_test

import (
	"errors"
	"testing"

	"nantty/modules/payments/src/utils"
)

func TestMajorDecimalConversionRoundTripsWithoutFloats(t *testing.T) {
	cases := []struct {
		minor    int64
		currency string
		decimal  string
	}{
		{150050, "NGN", "1500.50"}, {1, "USD", "0.01"}, {100, "GBP", "1.00"}, {0, "EUR", "0.00"},
		{5000, "JPY", "5000"}, {12345, "KWD", "12.345"}, {9_223_372_036_854_775_807, "USD", "92233720368547758.07"},
	}
	for _, testCase := range cases {
		formatted, err := utils.FormatMinorUnitsAsMajorDecimal(testCase.minor, testCase.currency)
		if err != nil || formatted.String() != testCase.decimal {
			t.Errorf("format %d %s = %q, %v; want %q", testCase.minor, testCase.currency, formatted, err, testCase.decimal)
		}
		parsed, err := utils.ParseMajorDecimalToMinorUnits(testCase.decimal, testCase.currency)
		if err != nil || parsed != testCase.minor {
			t.Errorf("parse %q %s = %d, %v; want %d", testCase.decimal, testCase.currency, parsed, err, testCase.minor)
		}
	}
}

func TestParseMajorDecimalRejectsAmbiguousOrLossyInput(t *testing.T) {
	accepted := map[string]int64{"1500.5": 150050, "1500": 150000, "1500.500": 150050, "0.10": 10}
	for raw, want := range accepted {
		if got, err := utils.ParseMajorDecimalToMinorUnits(raw, "NGN"); err != nil || got != want {
			t.Errorf("%q: got %d %v want %d", raw, got, err, want)
		}
	}
	for _, raw := range []string{"", "-5.00", "+5", "1e3", "1500.505", "abc", ".50", "1,500.00", "99999999999999999999.00"} {
		if _, err := utils.ParseMajorDecimalToMinorUnits(raw, "NGN"); !errors.Is(err, utils.ErrInvalidProviderAmount) {
			t.Errorf("%q should be rejected, got %v", raw, err)
		}
	}
	if _, err := utils.FormatMinorUnitsAsMajorDecimal(-1, "NGN"); err == nil {
		t.Error("negative amounts must not be formatted")
	}
}

func TestTransferFeeTiersPickTheFirstMatchingBand(t *testing.T) {
	tiers := []utils.TransferFeeTier{{UpToAmountMinor: 500_000, FeeMinor: 1_000}, {UpToAmountMinor: 5_000_000, FeeMinor: 2_500}, {FeeMinor: 5_000}}
	cases := map[int64]int64{1: 1_000, 500_000: 1_000, 500_001: 2_500, 5_000_000: 2_500, 5_000_001: 5_000, 900_000_000: 5_000}
	for amount, want := range cases {
		if got := utils.FeeForAmountFromTiers(tiers, amount); got != want {
			t.Errorf("amount %d: fee %d want %d", amount, got, want)
		}
	}
}
