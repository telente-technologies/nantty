package models

type PricingRules struct {
	YearlyDiscountBps       int64
	BundleDiscountBps       int64
	BundleMaximumBusinesses int
}

type PriceQuote struct {
	ListAmountMinor int64  `json:"listAmountMinor"`
	AmountMinor     int64  `json:"amountMinor"`
	DiscountKind    string `json:"discountKind"`
	DiscountBps     int64  `json:"discountBps"`
}

type PricingInput struct {
	MonthlyAmountMinor   int64
	Interval             string
	BundleEligiblePlan   bool
	HasActiveBlue        bool
	BundledBusinessCount int
}

func discounted(amountMinor, discountBps int64) int64 {
	if discountBps <= 0 {
		return amountMinor
	}
	return amountMinor - (amountMinor*discountBps+5_000)/10_000
}

func QuotePlanPrice(rules PricingRules, input PricingInput) PriceQuote {
	listAmount := input.MonthlyAmountMinor
	if input.Interval == "year" {
		listAmount = input.MonthlyAmountMinor * 12
	}
	bundleBps := int64(0)
	if input.BundleEligiblePlan && input.HasActiveBlue && input.BundledBusinessCount < rules.BundleMaximumBusinesses {
		bundleBps = rules.BundleDiscountBps
	}
	quote := PriceQuote{ListAmountMinor: listAmount, AmountMinor: listAmount, DiscountKind: "none"}
	yearlyBps := int64(0)
	if input.Interval == "year" {
		yearlyBps = rules.YearlyDiscountBps
	}
	switch {
	case yearlyBps > 0 && yearlyBps >= bundleBps:
		quote.DiscountKind, quote.DiscountBps = "yearly", yearlyBps
	case bundleBps > 0:
		quote.DiscountKind, quote.DiscountBps = "bundle", bundleBps
	}
	quote.AmountMinor = discounted(listAmount, quote.DiscountBps)
	return quote
}
