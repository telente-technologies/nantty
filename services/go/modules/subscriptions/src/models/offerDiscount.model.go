package models

const (
	OfferPercentage   = "percentage"
	OfferFixedAmount  = "fixed_amount"
	DiscountKindOffer = "offer"
	OfferLineLabel    = "Special offer"
)

type OfferTerms struct {
	Kind           string `json:"kind"`
	PercentOff     int64  `json:"percentOff,omitempty"`
	AmountOffMinor int64  `json:"amountOffMinor,omitempty"`
	Currency       string `json:"currency,omitempty"`
	PlanCode       string `json:"planCode,omitempty"`
}

func (terms OfferTerms) AppliesToCurrency(currency string) bool {
	return terms.Kind == OfferPercentage || (terms.Kind == OfferFixedAmount && terms.Currency == currency)
}

func (terms OfferTerms) DiscountMinorOn(grossMinor int64, currency string) int64 {
	if grossMinor <= 0 || !terms.AppliesToCurrency(currency) {
		return 0
	}
	if terms.Kind == OfferPercentage {
		return min((grossMinor*min(max(terms.PercentOff, 0), 100)*100+5_000)/10_000, grossMinor)
	}
	return min(max(terms.AmountOffMinor, 0), grossMinor)
}

func ApplyOfferWhenItBeatsTheQuote(quote PriceQuote, terms OfferTerms, currency string) (PriceQuote, bool) {
	discount := terms.DiscountMinorOn(quote.ListAmountMinor, currency)
	if discount <= 0 || quote.ListAmountMinor-discount >= quote.AmountMinor {
		return quote, false
	}
	return PriceQuote{
		ListAmountMinor: quote.ListAmountMinor, AmountMinor: quote.ListAmountMinor - discount, DiscountKind: DiscountKindOffer,
		DiscountBps: discount * 10_000 / quote.ListAmountMinor, OfferDiscountMinor: discount,
	}, true
}
