package models_test

import (
	"testing"

	"nantty/modules/subscriptions/src/models"
)

func TestOfferDiscountsPickTheBestSingleDiscount(t *testing.T) {
	cases := []struct {
		name     string
		quote    models.PriceQuote
		terms    models.OfferTerms
		currency string
		amount   int64
		applied  bool
	}{
		{"percent beats no discount", models.PriceQuote{ListAmountMinor: 500_000, AmountMinor: 500_000, DiscountKind: "none"}, models.OfferTerms{Kind: models.OfferPercentage, PercentOff: 30}, "NGN", 350_000, true},
		{"yearly beats a smaller offer", models.PriceQuote{ListAmountMinor: 6_000_000, AmountMinor: 4_800_000, DiscountKind: "yearly"}, models.OfferTerms{Kind: models.OfferPercentage, PercentOff: 10}, "NGN", 4_800_000, false},
		{"offer beats the bundle", models.PriceQuote{ListAmountMinor: 300_000, AmountMinor: 255_000, DiscountKind: "bundle"}, models.OfferTerms{Kind: models.OfferPercentage, PercentOff: 50}, "NGN", 150_000, true},
		{"a tie keeps the existing discount", models.PriceQuote{ListAmountMinor: 300_000, AmountMinor: 255_000, DiscountKind: "bundle"}, models.OfferTerms{Kind: models.OfferPercentage, PercentOff: 15}, "NGN", 255_000, false},
		{"fixed amount in the right currency", models.PriceQuote{ListAmountMinor: 500_000, AmountMinor: 500_000}, models.OfferTerms{Kind: models.OfferFixedAmount, AmountOffMinor: 200_000, Currency: "NGN"}, "NGN", 300_000, true},
		{"fixed amount never goes below zero", models.PriceQuote{ListAmountMinor: 500_000, AmountMinor: 500_000}, models.OfferTerms{Kind: models.OfferFixedAmount, AmountOffMinor: 900_000, Currency: "NGN"}, "NGN", 0, true},
		{"fixed amount in another currency", models.PriceQuote{ListAmountMinor: 500_000, AmountMinor: 500_000}, models.OfferTerms{Kind: models.OfferFixedAmount, AmountOffMinor: 500, Currency: "USD"}, "NGN", 500_000, false},
	}
	for _, testCase := range cases {
		quote, applied := models.ApplyOfferWhenItBeatsTheQuote(testCase.quote, testCase.terms, testCase.currency)
		if quote.AmountMinor != testCase.amount || applied != testCase.applied {
			t.Errorf("%s: got %d %v", testCase.name, quote.AmountMinor, applied)
		}
	}
}

func TestOfferDiscountLineReducesTheChargeAfterTheSplit(t *testing.T) {
	charge := models.ComputePeriodCharge(models.PeriodChargeInput{PlanLabel: "Pro", CheckmarkLabel: "Gold", PeriodPriceMinor: 500_000, CheckmarkStandaloneMinor: 200_000, CheckmarkSplit: models.CheckmarkSplitFromPlan, OfferDiscountMinor: 150_000})
	if charge.AmountDueMinor != 350_000 || !models.HasOfferDiscountLine(charge.LineItems) || models.DiscountLinesTotalMinor(charge) != 150_000 {
		t.Fatalf("charge: %+v", charge)
	}
}
