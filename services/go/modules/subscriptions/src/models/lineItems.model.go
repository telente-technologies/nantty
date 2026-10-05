package models

const (
	LineItemPlanBase        = "plan_base"
	LineItemCheckmark       = "checkmark"
	LineItemBundleDiscount  = "bundle_discount"
	LineItemProrationCredit = "proration_credit"

	CheckmarkSplitFromPlan = "split"
	CheckmarkIsWholePlan   = "whole"
	CheckmarkNotInPlan     = "none"
)

type LineItem struct {
	Kind        string `json:"kind"`
	Label       string `json:"label"`
	AmountMinor int64  `json:"amountMinor"`
}

type PeriodChargeInput struct {
	PlanLabel                string
	CheckmarkLabel           string
	PeriodPriceMinor         int64
	CheckmarkStandaloneMinor int64
	CheckmarkSplit           string
	BundleDiscountBps        int64
	AvailableCreditMinor     int64
}

type PeriodCharge struct {
	LineItems            []LineItem `json:"lineItems"`
	SubtotalMinor        int64      `json:"subtotalMinor"`
	CreditAppliedMinor   int64      `json:"creditAppliedMinor"`
	AmountDueMinor       int64      `json:"amountDueMinor"`
	RemainingCreditMinor int64      `json:"remainingCreditMinor"`
	CheckmarkIncluded    bool       `json:"checkmarkIncluded"`
}

func SplitPeriodPrice(periodPriceMinor, checkmarkStandaloneMinor int64, split string) (baseMinor, checkmarkMinor int64) {
	switch split {
	case CheckmarkSplitFromPlan:
		checkmarkMinor = min(max(checkmarkStandaloneMinor, 0), periodPriceMinor)
		return periodPriceMinor - checkmarkMinor, checkmarkMinor
	case CheckmarkIsWholePlan:
		return 0, periodPriceMinor
	}
	return periodPriceMinor, 0
}

func ComputePeriodCharge(input PeriodChargeInput) PeriodCharge {
	base, checkmark := SplitPeriodPrice(max(input.PeriodPriceMinor, 0), input.CheckmarkStandaloneMinor, input.CheckmarkSplit)
	charge := PeriodCharge{LineItems: []LineItem{}, CheckmarkIncluded: checkmark > 0}
	gross := int64(0)
	if base > 0 {
		charge.LineItems = append(charge.LineItems, LineItem{Kind: LineItemPlanBase, Label: input.PlanLabel, AmountMinor: base})
		gross += base
	}
	if charge.CheckmarkIncluded {
		charge.LineItems = append(charge.LineItems, LineItem{Kind: LineItemCheckmark, Label: input.CheckmarkLabel, AmountMinor: checkmark})
		gross += checkmark
	}
	if discount := (gross*max(input.BundleDiscountBps, 0) + 5_000) / 10_000; discount > 0 {
		charge.LineItems = append(charge.LineItems, LineItem{Kind: LineItemBundleDiscount, Label: "Blue + Gold bundle", AmountMinor: -discount})
		gross -= discount
	}
	charge.SubtotalMinor = gross
	charge.CreditAppliedMinor = min(max(input.AvailableCreditMinor, 0), gross)
	if charge.CreditAppliedMinor > 0 {
		charge.LineItems = append(charge.LineItems, LineItem{Kind: LineItemProrationCredit, Label: "Credit from your previous plan", AmountMinor: -charge.CreditAppliedMinor})
	}
	charge.AmountDueMinor = gross - charge.CreditAppliedMinor
	charge.RemainingCreditMinor = max(input.AvailableCreditMinor, 0) - charge.CreditAppliedMinor
	return charge
}
