package regionpricing

var checkmarkStandalonePlan = map[string]string{"blue": "blue", "gold": "gold_only"}

// CheckmarkStandalonePlan names the standalone plan whose price is the checkmark's share when the checkmark came
// bundled with a seller plan or Premium.
func CheckmarkStandalonePlan(checkmark string) string {
	return checkmarkStandalonePlan[checkmark]
}

// CheckmarkShareMinor is the part of a period's payment that belongs to the checkmark: the standalone checkmark price
// for that region and interval, never more than what was paid.
func CheckmarkShareMinor(standaloneMinor, paidMinor int64) int64 {
	return max(0, min(standaloneMinor, paidMinor))
}

// DefaultCheckmarkStandalonePrice reads the research price book for a checkmark on a channel and interval, using the
// web price when the plan is not sold in that store.
func DefaultCheckmarkStandalonePrice(checkmark, currency, channel, interval string) int64 {
	region, found := RegionForCurrency(currency)
	if !found {
		return 0
	}
	price, found := FindDefaultPlanPrice(CheckmarkStandalonePlan(checkmark), region.Code)
	if !found {
		return 0
	}
	if amount := price.AmountFor(channel, interval); amount > 0 {
		return amount
	}
	return price.AmountFor("web", interval)
}
