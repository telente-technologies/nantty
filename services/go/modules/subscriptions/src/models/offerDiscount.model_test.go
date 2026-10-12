package models

import "testing"

func TestOfferDiscountsPickTheBestSingleDiscount(t *testing.T) {
	cases := []struct {
		name     string
		quote    PriceQuote
		terms    OfferTerms
		currency string
		amount   int64
		applied  bool
	}{
		{"percent beats no discount", PriceQuote{ListAmountMinor: 500_000, AmountMinor: 500_000, DiscountKind: "none"}, OfferTerms{Kind: OfferPercentage, PercentOff: 30}, "NGN", 350_000, true},
		{"yearly beats a smaller offer", PriceQuote{ListAmountMinor: 6_000_000, AmountMinor: 4_800_000, DiscountKind: "yearly"}, OfferTerms{Kind: OfferPercentage, PercentOff: 10}, "NGN", 4_800_000, false},
		{"offer beats the bundle", PriceQuote{ListAmountMinor: 300_000, AmountMinor: 255_000, DiscountKind: "bundle"}, OfferTerms{Kind: OfferPercentage, PercentOff: 50}, "NGN", 150_000, true},
		{"a tie keeps the existing discount", PriceQuote{ListAmountMinor: 300_000, AmountMinor: 255_000, DiscountKind: "bundle"}, OfferTerms{Kind: OfferPercentage, PercentOff: 15}, "NGN", 255_000, false},
		{"fixed amount in the right currency", PriceQuote{ListAmountMinor: 500_000, AmountMinor: 500_000}, OfferTerms{Kind: OfferFixedAmount, AmountOffMinor: 200_000, Currency: "NGN"}, "NGN", 300_000, true},
		{"fixed amount never goes below zero", PriceQuote{ListAmountMinor: 500_000, AmountMinor: 500_000}, OfferTerms{Kind: OfferFixedAmount, AmountOffMinor: 900_000, Currency: "NGN"}, "NGN", 0, true},
		{"fixed amount in another currency", PriceQuote{ListAmountMinor: 500_000, AmountMinor: 500_000}, OfferTerms{Kind: OfferFixedAmount, AmountOffMinor: 500, Currency: "USD"}, "NGN", 500_000, false},
	}
	for _, testCase := range cases {
		quote, applied := ApplyOfferWhenItBeatsTheQuote(testCase.quote, testCase.terms, testCase.currency)
		if quote.AmountMinor != testCase.amount || applied != testCase.applied {
			t.Errorf("%s: got %d %v", testCase.name, quote.AmountMinor, applied)
		}
	}
}

func TestOfferDiscountLineReducesTheChargeAfterTheSplit(t *testing.T) {
	charge := ComputePeriodCharge(PeriodChargeInput{PlanLabel: "Pro", CheckmarkLabel: "Gold", PeriodPriceMinor: 500_000, CheckmarkStandaloneMinor: 200_000, CheckmarkSplit: CheckmarkSplitFromPlan, OfferDiscountMinor: 150_000})
	if charge.AmountDueMinor != 350_000 || !HasOfferDiscountLine(charge.LineItems) || DiscountLinesTotalMinor(charge) != 150_000 {
		t.Fatalf("charge: %+v", charge)
	}
}
