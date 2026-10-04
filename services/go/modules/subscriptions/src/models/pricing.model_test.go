package models

import "testing"

func TestBundleAndYearlyDiscountsNeverStackAndTheBiggerWins(t *testing.T) {
	rules := PricingRules{YearlyDiscountBps: 2000, BundleDiscountBps: 1500, BundleMaximumBusinesses: 3}
	cases := []struct {
		name     string
		rules    PricingRules
		input    PricingInput
		amount   int64
		discount string
	}{
		{"gold monthly with blue gets the bundle", rules, PricingInput{MonthlyAmountMinor: 300_000, Interval: "month", BundleEligiblePlan: true, HasActiveBlue: true}, 255_000, "bundle"},
		{"gold monthly without blue pays list", rules, PricingInput{MonthlyAmountMinor: 300_000, Interval: "month", BundleEligiblePlan: true}, 300_000, "none"},
		{"yearly beats the bundle", rules, PricingInput{MonthlyAmountMinor: 300_000, Interval: "year", BundleEligiblePlan: true, HasActiveBlue: true}, 2_880_000, "yearly"},
		{"bundle beats a smaller yearly discount", PricingRules{YearlyDiscountBps: 1000, BundleDiscountBps: 1500, BundleMaximumBusinesses: 3}, PricingInput{MonthlyAmountMinor: 300_000, Interval: "year", BundleEligiblePlan: true, HasActiveBlue: true}, 3_060_000, "bundle"},
		{"fourth business loses the bundle", rules, PricingInput{MonthlyAmountMinor: 500_000, Interval: "month", BundleEligiblePlan: true, HasActiveBlue: true, BundledBusinessCount: 3}, 500_000, "none"},
		{"black never gets the bundle", rules, PricingInput{MonthlyAmountMinor: 5_000_000, Interval: "month", BundleEligiblePlan: false, HasActiveBlue: true}, 5_000_000, "none"},
		{"an explicit regional yearly price is charged as is", rules, PricingInput{MonthlyAmountMinor: 599, YearlyAmountMinor: 5_799, Interval: "year"}, 5_799, "yearly"},
		{"black yearly still gets the yearly discount", rules, PricingInput{MonthlyAmountMinor: 5_000_000, Interval: "year"}, 48_000_000, "yearly"},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			quote := QuotePlanPrice(testCase.rules, testCase.input)
			if quote.AmountMinor != testCase.amount || quote.DiscountKind != testCase.discount {
				t.Fatalf("quote %+v", quote)
			}
		})
	}
}
