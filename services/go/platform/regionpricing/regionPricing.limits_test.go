package regionpricing

import "testing"

func TestLimitsConvertFromNairaAndRoundToTwoSignificantFigures(t *testing.T) {
	if got := ConvertLimitFromBaseCurrency(1_000_000, "NGN", DefaultUsdRatesE8); got != 1_000_000 {
		t.Fatalf("naira is the base: %d", got)
	}
	for _, currency := range []string{"GHS", "KES", "USD", "ZAR"} {
		got := ConvertLimitFromBaseCurrency(500_000, currency, DefaultUsdRatesE8)
		major := got / 100
		if got <= 0 || got%100 != 0 {
			t.Fatalf("%s limit must be whole major units: %d", currency, got)
		}
		digits := 0
		for value := major; value > 0; value /= 10 {
			digits++
		}
		for trailing, value := 0, major; digits > 2 && trailing < digits-2; trailing, value = trailing+1, value/10 {
			if value%10 != 0 {
				t.Fatalf("%s limit %d is not rounded to two significant figures", currency, major)
			}
		}
	}
	if got := RoundLimitToSensibleUnit(37, 100); got != 100 {
		t.Fatalf("anything under one unit rounds up to one unit: %d", got)
	}
	if got := RoundLimitToSensibleUnit(4_160_00, 100); got != 4_200_00 {
		t.Fatalf("416 rounds to 420: %d", got)
	}
	if got := ConvertLimitFromBaseCurrency(1_000_000, "GHS", map[string]int64{"NGN": 1}); got != 0 {
		t.Fatalf("a missing rate gives no converted limit: %d", got)
	}
}
