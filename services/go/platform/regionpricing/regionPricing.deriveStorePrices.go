package regionpricing

// DeriveStorePrices keeps the web catalogue as the price source of truth and
// calculates the gross storefront amounts from the effective store fee rates.
// The values are still estimates until the matching store product is updated;
// native store metadata remains authoritative at purchase time.
func DeriveStorePrices(price PlanRegionalPrice, fees StoreFeeSettings, yearlyDiscountBps int64) PlanRegionalPrice {
	if !inAppPlans[price.PlanCode] || price.WebMonthlyMinor <= 0 {
		return price
	}
	if yearlyDiscountBps < 0 || yearlyDiscountBps >= 10_000 {
		yearlyDiscountBps = DefaultYearlyDiscountBps
	}
	webYearly := price.WebYearlyMinor
	if webYearly <= 0 {
		webYearly = YearlyFromMonthly(price.WebMonthlyMinor, yearlyDiscountBps, price.Currency)
	}
	price.IosMonthlyMinor = GrossUpForStoreFee(price.WebMonthlyMinor, fees.FeeBpsForChannel("ios"), price.Currency)
	price.IosYearlyMinor = GrossUpForStoreFee(webYearly, fees.FeeBpsForChannel("ios"), price.Currency)
	price.AndroidMonthlyMinor = GrossUpForStoreFee(price.WebMonthlyMinor, fees.FeeBpsForChannel("android"), price.Currency)
	price.AndroidYearlyMinor = GrossUpForStoreFee(webYearly, fees.FeeBpsForChannel("android"), price.Currency)
	return price
}
