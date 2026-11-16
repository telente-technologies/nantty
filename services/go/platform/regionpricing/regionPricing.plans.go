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

const (
	UsdBillingNote                     = "Billed in USD"
	BlackUsdMonthlyNigeriaMinor  int64 = 30_000
	BlackUsdMonthlyIntlMinor     int64 = 50_000
	BlackCurrencyCode                  = "USD"
)

type monthlyPair struct{ web, app int64 }

var inAppPlans = map[string]bool{"blue_essential": true, "blue": true, "premium": true, "seller_pro": true, "seller_business": true}

var defaultMonthlyPlanPrices = map[string]map[string]int64{
	"blue_essential":  {"NG": 100_000, "GH": 1_200, "KE": 20_000, "ZA": 2_999, "GB": 249, "EU": 249, "US": 249},
	"blue":            {"NG": 250_000, "GH": 3_000, "KE": 50_000, "ZA": 5_999, "GB": 599, "EU": 599, "US": 599},
	"premium":         {"NG": 2_000_000, "GH": 5_500, "KE": 90_000, "ZA": 10_999, "GB": 999, "EU": 1_099, "US": 999},
	"seller_pro":      {"NG": 500_000, "GH": 6_000, "KE": 100_000, "ZA": 14_999, "GB": 1_500, "EU": 1_700, "US": 1_700},
	"seller_business": {"NG": 3_000_000, "GH": 18_000, "KE": 300_000, "ZA": 44_999, "GB": 4_500, "EU": 4_900, "US": 4_900},
	"gold_only":       {"NG": 300_000, "GH": 3_600, "KE": 60_000, "ZA": 8_999, "GB": 900, "EU": 1_000, "US": 1_000},
	"black":           {"NG": BlackUsdMonthlyNigeriaMinor, "GH": BlackUsdMonthlyIntlMinor, "KE": BlackUsdMonthlyIntlMinor, "ZA": BlackUsdMonthlyIntlMinor, "GB": BlackUsdMonthlyIntlMinor, "EU": BlackUsdMonthlyIntlMinor, "US": BlackUsdMonthlyIntlMinor},
}

func DefaultStoreProductId(planCode, interval string) string {
	return "com.nantty.app." + planCode + "." + map[string]string{"month": "monthly", "year": "yearly"}[interval]
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
			webMonthly := byRegion[region.Code]
			currency := region.Currency
			webYearly := YearlyFromMonthly(webMonthly, DefaultYearlyDiscountBps, currency)
			if planCode == "black" {
				currency = BlackCurrencyCode
				webYearly = 0
			}
			price := PlanRegionalPrice{
				PlanCode: planCode, Region: region.Code, Currency: currency,
				WebMonthlyMinor: webMonthly, WebYearlyMinor: webYearly,
				StoreProductIds: defaultStoreProductIds(planCode),
			}
			if inAppPlans[planCode] {
				price = DeriveStorePrices(price, DefaultStoreFeeSettings(), DefaultYearlyDiscountBps)
			}
			prices = append(prices, price)
		}
	}
	return prices
}

func BlackMonthlyPriceForJurisdiction(countryCode string) PlanRegionalPrice {
	region, found := RegionForCountry(countryCode)
	regionCode := FallbackRegion.Code
	monthly := BlackUsdMonthlyIntlMinor
	if found && region.Code == "NG" {
		regionCode = "NG"
		monthly = BlackUsdMonthlyNigeriaMinor
	}
	return PlanRegionalPrice{
		PlanCode:        "black",
		Region:          regionCode,
		Currency:        BlackCurrencyCode,
		WebMonthlyMinor: monthly,
		StoreProductIds: map[string]string{},
	}
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
