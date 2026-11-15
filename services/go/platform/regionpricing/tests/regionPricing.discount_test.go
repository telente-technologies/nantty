package regionpricing_test

import (
	. "nantty/platform/regionpricing"
	"testing"
)

func TestCalculateDiscountUsesMinorUnitsAndCapsFixedDiscount(t *testing.T) {
	percentage, err := CalculateDiscount(DiscountInput{Kind: DiscountPercentage, Currency: "NGN", SubtotalMinor: 10_001, DiscountRateBps: 1_000})
	if err != nil || percentage.DiscountMinor != 1_000 || percentage.PayableMinor != 9_001 {
		t.Fatalf("percentage discount: %+v, %v", percentage, err)
	}
	fixed, err := CalculateDiscount(DiscountInput{Kind: DiscountFixed, Currency: "KES", SubtotalMinor: 150, DiscountMinor: 500})
	if err != nil || fixed.DiscountMinor != 150 || fixed.PayableMinor != 0 {
		t.Fatalf("fixed discount cap: %+v, %v", fixed, err)
	}
}

func TestCalculateDiscountMakesAnnualAndBundleInterpretationsExplicit(t *testing.T) {
	annual, err := CalculateDiscount(DiscountInput{Kind: DiscountAnnual, Currency: "GBP", SubtotalMinor: 1_000, DiscountRateBps: DefaultYearlyDiscountBps})
	if err != nil || annual.DiscountMinor != 200 || annual.PayableMinor != 800 {
		t.Fatalf("annual discount: %+v, %v", annual, err)
	}
	combined, err := CalculateDiscount(DiscountInput{Kind: DiscountBundleTotal, Currency: "NGN", SubtotalMinor: 25_000, HigherPlanMinor: 20_000, DiscountRateBps: 1_000})
	if err != nil || combined.DiscountMinor != 2_500 || combined.PayableMinor != 22_500 {
		t.Fatalf("combined-subtotal discount: %+v, %v", combined, err)
	}
	higher, err := CalculateDiscount(DiscountInput{Kind: DiscountBundleHigher, Currency: "NGN", SubtotalMinor: 25_000, HigherPlanMinor: 20_000, DiscountRateBps: 1_000})
	if err != nil || higher.DiscountMinor != 2_000 || higher.PayableMinor != 23_000 {
		t.Fatalf("higher-plan discount: %+v, %v", higher, err)
	}
}

func TestCalculateDiscountRejectsInvalidAndImplicitStackingInputs(t *testing.T) {
	for _, input := range []DiscountInput{
		{Kind: DiscountPercentage, Currency: "USD", SubtotalMinor: 100, DiscountRateBps: 10_001},
		{Kind: DiscountFixed, Currency: "USD", SubtotalMinor: 100},
		{Kind: "stacked", Currency: "USD", SubtotalMinor: 100, DiscountRateBps: 500},
		{Kind: DiscountBundleHigher, Currency: "USD", SubtotalMinor: 100, HigherPlanMinor: 101, DiscountRateBps: 500},
	} {
		if _, err := CalculateDiscount(input); err == nil {
			t.Fatalf("expected invalid discount to be rejected: %+v", input)
		}
	}
}
