package models

const (
	CombinedGoldYearlyReplacesStandard = "replace"
	CombinedGoldYearlyAddsToStandard   = "add"

	DiscountKindMultiBusiness = "multi_business"

	LineItemMultiBusinessDiscount = "multi_business_discount"
	LineItemYearlyExtraDiscount   = "yearly_extra_discount"
	LineItemYearlyDiscount        = "yearly_discount"
)

type CombinedGoldRules struct {
	SingleProfileBps  int64
	BaseBps           int64
	StepBps           int64
	MaximumProfiles   int
	YearlyExtraBps    int64
	YearlyMode        string
	StandardYearlyBps int64
}

func DefaultCombinedGoldRules(standardYearlyBps int64) CombinedGoldRules {
	return CombinedGoldRules{SingleProfileBps: 500, BaseBps: 1000, StepBps: 200, MaximumProfiles: 5, YearlyExtraBps: 500, YearlyMode: CombinedGoldYearlyReplacesStandard, StandardYearlyBps: standardYearlyBps}
}

type CombinedGoldInput struct {
	UnitMonthlyMinor int64
	ProfileCount     int
	Interval         string
	TierAllowed      bool
}

type CombinedGoldQuote struct {
	UnitMonthlyMinor            int64      `json:"unitMonthlyMinor"`
	ProfileCount                int        `json:"profileCount"`
	Months                      int64      `json:"months"`
	Interval                    string     `json:"interval"`
	GrossMinor                  int64      `json:"grossMinor"`
	TierBps                     int64      `json:"tierBps"`
	TierDiscountMinor           int64      `json:"tierDiscountMinor"`
	YearlyExtraBps              int64      `json:"yearlyExtraBps"`
	YearlyExtraDiscountMinor    int64      `json:"yearlyExtraDiscountMinor"`
	StandardYearlyBps           int64      `json:"standardYearlyBps"`
	StandardYearlyDiscountMinor int64      `json:"standardYearlyDiscountMinor"`
	TotalMinor                  int64      `json:"totalMinor"`
	PerProfileMinor             []int64    `json:"perProfileMinor"`
	LineItems                   []LineItem `json:"lineItems"`
}

func CombinedGoldTierBps(rules CombinedGoldRules, profileCount int) int64 {
	switch {
	case profileCount <= 0:
		return 0
	case profileCount == 1:
		return max(rules.SingleProfileBps, 0)
	}
	return min(max(rules.BaseBps+rules.StepBps*int64(min(profileCount, max(rules.MaximumProfiles, 2))-2), 0), 9_000)
}

func roundedShare(amountMinor, bps int64) int64 {
	if bps <= 0 || amountMinor <= 0 {
		return 0
	}
	return (amountMinor*bps + 5_000) / 10_000
}

func QuoteCombinedGold(rules CombinedGoldRules, input CombinedGoldInput) CombinedGoldQuote {
	months := int64(1)
	if input.Interval == "year" {
		months = 12
	}
	quote := CombinedGoldQuote{UnitMonthlyMinor: input.UnitMonthlyMinor, ProfileCount: input.ProfileCount, Months: months, Interval: input.Interval, LineItems: []LineItem{}}
	monthlyGross := input.UnitMonthlyMinor * int64(max(input.ProfileCount, 0))
	quote.GrossMinor = monthlyGross * months
	monthly := monthlyGross
	if input.TierAllowed {
		quote.TierBps = CombinedGoldTierBps(rules, input.ProfileCount)
		monthly -= roundedShare(monthlyGross, quote.TierBps)
	}
	total := monthly * months
	quote.TierDiscountMinor = quote.GrossMinor - total
	if months == 12 {
		quote.YearlyExtraBps = max(rules.YearlyExtraBps, 0)
		if !input.TierAllowed {
			quote.YearlyExtraBps = 0
		}
		quote.YearlyExtraDiscountMinor = roundedShare(total, quote.YearlyExtraBps)
		total -= quote.YearlyExtraDiscountMinor
		if rules.YearlyMode == CombinedGoldYearlyAddsToStandard || !input.TierAllowed {
			quote.StandardYearlyBps = max(rules.StandardYearlyBps, 0)
			quote.StandardYearlyDiscountMinor = roundedShare(total, quote.StandardYearlyBps)
			total -= quote.StandardYearlyDiscountMinor
		}
	}
	quote.TotalMinor = max(total, 0)
	quote.PerProfileMinor = AllocateEvenly(quote.TotalMinor, input.ProfileCount)
	quote.LineItems = combinedGoldLineItems(quote)
	return quote
}

func combinedGoldLineItems(quote CombinedGoldQuote) []LineItem {
	items := []LineItem{{Kind: LineItemCheckmark, Label: "Gold checkmark for your businesses", AmountMinor: quote.GrossMinor}}
	for _, discount := range []LineItem{
		{Kind: LineItemMultiBusinessDiscount, Label: "Multi-business discount", AmountMinor: -quote.TierDiscountMinor},
		{Kind: LineItemYearlyExtraDiscount, Label: "Extra yearly discount", AmountMinor: -quote.YearlyExtraDiscountMinor},
		{Kind: LineItemYearlyDiscount, Label: "Yearly discount", AmountMinor: -quote.StandardYearlyDiscountMinor},
	} {
		if discount.AmountMinor < 0 {
			items = append(items, discount)
		}
	}
	return items
}

func (quote CombinedGoldQuote) AsPriceQuote() PriceQuote {
	price := PriceQuote{ListAmountMinor: quote.GrossMinor, AmountMinor: quote.TotalMinor, DiscountKind: "none"}
	if quote.GrossMinor > 0 && quote.TotalMinor < quote.GrossMinor {
		price.DiscountKind, price.DiscountBps = DiscountKindMultiBusiness, (quote.GrossMinor-quote.TotalMinor)*10_000/quote.GrossMinor
		if quote.TierBps == 0 {
			price.DiscountKind = "yearly"
		}
	}
	return price
}

func CombinedGoldCharge(quote CombinedGoldQuote, price PriceQuote, availableCreditMinor int64) PeriodCharge {
	items := quote.LineItems
	if price.DiscountKind == DiscountKindOffer {
		items = []LineItem{quote.LineItems[0], {Kind: LineItemOfferDiscount, Label: OfferLineLabel, AmountMinor: -price.OfferDiscountMinor}}
	}
	charge := PeriodCharge{LineItems: append([]LineItem{}, items...), SubtotalMinor: price.AmountMinor, CheckmarkIncluded: price.AmountMinor > 0 || quote.GrossMinor > 0}
	charge.CreditAppliedMinor = min(max(availableCreditMinor, 0), charge.SubtotalMinor)
	if charge.CreditAppliedMinor > 0 {
		charge.LineItems = append(charge.LineItems, LineItem{Kind: LineItemProrationCredit, Label: "Credit from your previous plan", AmountMinor: -charge.CreditAppliedMinor})
	}
	charge.AmountDueMinor = charge.SubtotalMinor - charge.CreditAppliedMinor
	charge.RemainingCreditMinor = max(availableCreditMinor, 0) - charge.CreditAppliedMinor
	return charge
}

func AllocateEvenly(totalMinor int64, parts int) []int64 {
	if parts <= 0 {
		return []int64{}
	}
	shares := make([]int64, parts)
	base, remainder := totalMinor/int64(parts), totalMinor%int64(parts)
	for index := range shares {
		shares[index] = base
		if int64(index) < remainder {
			shares[index]++
		}
	}
	return shares
}
