package regionpricing

var checkmarkStandalonePlan = map[string]string{"blue": "blue", "gold": "gold_only"}

func CheckmarkStandalonePlan(checkmark string) string {
	return checkmarkStandalonePlan[checkmark]
}

func CheckmarkShareMinor(standaloneMinor, paidMinor int64) int64 {
	return max(0, min(standaloneMinor, paidMinor))
}

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
