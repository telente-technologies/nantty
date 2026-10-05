package regionpricing

const DefaultYearlyDiscountBps int64 = 2000

type PlanRegionalPrice struct {
	PlanCode            string            `json:"planCode"`
	Region              string            `json:"region"`
	Currency            string            `json:"currency"`
	WebMonthlyMinor     int64             `json:"webMonthlyMinor"`
	WebYearlyMinor      int64             `json:"webYearlyMinor"`
	IosMonthlyMinor     int64             `json:"iosMonthlyMinor"`
	IosYearlyMinor      int64             `json:"iosYearlyMinor"`
	AndroidMonthlyMinor int64             `json:"androidMonthlyMinor"`
	AndroidYearlyMinor  int64             `json:"androidYearlyMinor"`
	StoreProductIds     map[string]string `json:"storeProductIds"`
	BilledInUsdFallback bool              `json:"-"`
	NotChargeableOnWeb  bool              `json:"-"`
}

const UsdBillingNote = "Billed in USD"

type monthlyPair struct{ web, app int64 }

var inAppPlans = map[string]bool{"blue_essential": true, "blue": true, "premium": true}

var defaultMonthlyPlanPrices = map[string]map[string]monthlyPair{
	"blue_essential":  {"NG": {100_000, 120_000}, "GH": {1_200, 1_500}, "KE": {20_000, 25_000}, "ZA": {2_999, 3_499}, "GB": {249, 299}, "EU": {249, 299}, "US": {249, 299}},
	"blue":            {"NG": {250_000, 290_000}, "GH": {3_000, 3_500}, "KE": {50_000, 60_000}, "ZA": {5_999, 6_999}, "GB": {599, 699}, "EU": {599, 699}, "US": {599, 699}},
	"premium":         {"NG": {450_000, 550_000}, "GH": {5_500, 6_500}, "KE": {90_000, 110_000}, "ZA": {10_999, 12_999}, "GB": {999, 1_199}, "EU": {1_099, 1_299}, "US": {999, 1_199}},
	"seller_pro":      {"NG": {500_000, 0}, "GH": {6_000, 0}, "KE": {100_000, 0}, "ZA": {14_999, 0}, "GB": {1_500, 0}, "EU": {1_700, 0}, "US": {1_700, 0}},
	"seller_business": {"NG": {1_500_000, 0}, "GH": {18_000, 0}, "KE": {300_000, 0}, "ZA": {44_999, 0}, "GB": {4_500, 0}, "EU": {4_900, 0}, "US": {4_900, 0}},
	"gold_only":       {"NG": {300_000, 0}, "GH": {3_600, 0}, "KE": {60_000, 0}, "ZA": {8_999, 0}, "GB": {900, 0}, "EU": {1_000, 0}, "US": {1_000, 0}},
	"black":           {"NG": {5_000_000, 0}, "GH": {60_000, 0}, "KE": {1_000_000, 0}, "ZA": {149_999, 0}, "GB": {14_900, 0}, "EU": {16_900, 0}, "US": {16_900, 0}},
}

func DefaultStoreProductId(planCode, interval string) string {
	return "com.zudomart.app." + planCode + "." + map[string]string{"month": "monthly", "year": "yearly"}[interval]
}

func defaultStoreProductIds(planCode string) map[string]string {
	if !inAppPlans[planCode] {
		return map[string]string{}
	}
	ids := map[string]string{}
	for _, channel := range []string{"ios", "android"} {
		for _, interval := range []string{"month", "year"} {
			ids[channel+"."+interval] = DefaultStoreProductId(planCode, interval)
		}
	}
	return ids
}

func DefaultPlanPrices() []PlanRegionalPrice {
	var prices []PlanRegionalPrice
	for _, region := range supportedRegions {
		for planCode, byRegion := range defaultMonthlyPlanPrices {
			pair := byRegion[region.Code]
			price := PlanRegionalPrice{
				PlanCode: planCode, Region: region.Code, Currency: region.Currency,
				WebMonthlyMinor: pair.web, WebYearlyMinor: YearlyFromMonthly(pair.web, DefaultYearlyDiscountBps, region.Currency),
				StoreProductIds: defaultStoreProductIds(planCode),
			}
			if pair.app > 0 {
				appYearly := YearlyFromMonthly(pair.app, DefaultYearlyDiscountBps, region.Currency)
				price.IosMonthlyMinor, price.IosYearlyMinor = pair.app, appYearly
				price.AndroidMonthlyMinor, price.AndroidYearlyMinor = pair.app, appYearly
			}
			prices = append(prices, price)
		}
	}
	return prices
}

func FindDefaultPlanPrice(planCode, region string) (PlanRegionalPrice, bool) {
	for _, price := range DefaultPlanPrices() {
		if price.PlanCode == planCode && price.Region == region {
			return price, true
		}
	}
	return PlanRegionalPrice{}, false
}

func (price PlanRegionalPrice) AmountFor(channel, interval string) int64 {
	switch channel + "." + interval {
	case "ios.month":
		return price.IosMonthlyMinor
	case "ios.year":
		return price.IosYearlyMinor
	case "android.month":
		return price.AndroidMonthlyMinor
	case "android.year":
		return price.AndroidYearlyMinor
	case "web.year":
		return price.WebYearlyMinor
	}
	return price.WebMonthlyMinor
}

func (price PlanRegionalPrice) StoreProductIdFor(channel, interval string) string {
	if channel == "web" {
		return ""
	}
	return price.StoreProductIds[channel+"."+interval]
}
