package models_test

import (
	"testing"

	"nantty/modules/subscriptions/src/models"
)

func TestPlansAlwaysRenewAtFullPriceWithTheCheckmarkLineShown(t *testing.T) {
	cases := []struct {
		name      string
		input     models.PeriodChargeInput
		due       int64
		items     int
		checkmark bool
	}{
		{"pro with a passed checkmark", models.PeriodChargeInput{PeriodPriceMinor: 500_000, CheckmarkStandaloneMinor: 300_000, CheckmarkSplit: models.CheckmarkSplitFromPlan}, 500_000, 2, true},
		{"premium always shows and charges its checkmark line", models.PeriodChargeInput{PeriodPriceMinor: 450_000, CheckmarkStandaloneMinor: 250_000, CheckmarkSplit: models.CheckmarkSplitFromPlan}, 450_000, 2, true},
		{"checkmark price above the plan is capped", models.PeriodChargeInput{PeriodPriceMinor: 200_000, CheckmarkStandaloneMinor: 300_000, CheckmarkSplit: models.CheckmarkSplitFromPlan}, 200_000, 1, true},
		{"standalone blue is the checkmark", models.PeriodChargeInput{PeriodPriceMinor: 250_000, CheckmarkSplit: models.CheckmarkIsWholePlan}, 250_000, 1, true},
		{"blue essential has no checkmark", models.PeriodChargeInput{PeriodPriceMinor: 100_000, CheckmarkSplit: models.CheckmarkNotInPlan}, 100_000, 1, false},
		{"gold bundle discount", models.PeriodChargeInput{PeriodPriceMinor: 300_000, CheckmarkSplit: models.CheckmarkIsWholePlan, BundleDiscountBps: 1500}, 255_000, 2, true},
		{"credit is used up first", models.PeriodChargeInput{PeriodPriceMinor: 1_500_000, CheckmarkStandaloneMinor: 300_000, CheckmarkSplit: models.CheckmarkSplitFromPlan, AvailableCreditMinor: 400_000}, 1_100_000, 3, true},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			charge := models.ComputePeriodCharge(testCase.input)
			sum := int64(0)
			for _, item := range charge.LineItems {
				sum += item.AmountMinor
			}
			if charge.AmountDueMinor != testCase.due || len(charge.LineItems) != testCase.items || charge.CheckmarkIncluded != testCase.checkmark || sum != charge.AmountDueMinor {
				t.Fatalf("charge %+v", charge)
			}
		})
	}
	big := models.ComputePeriodCharge(models.PeriodChargeInput{PeriodPriceMinor: 100_000, CheckmarkSplit: models.CheckmarkNotInPlan, AvailableCreditMinor: 250_000})
	if big.AmountDueMinor != 0 || big.RemainingCreditMinor != 150_000 {
		t.Fatalf("leftover credit carries to the next period: %+v", big)
	}
}
