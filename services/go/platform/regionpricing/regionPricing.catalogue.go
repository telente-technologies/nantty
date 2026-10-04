package regionpricing

type CoinPackTier struct {
	Tier          string `json:"tier"`
	Coins         int64  `json:"coins"`
	WebBonusCoins int64  `json:"webBonusCoins"`
	SortOrder     int    `json:"sortOrder"`
}

var DefaultCoinPackTiers = []CoinPackTier{
	{"1", 100, 0, 1}, {"2", 500, 0, 2}, {"3", 1_000, 30, 3}, {"4", 2_500, 100, 4}, {"5", 5_000, 250, 5}, {"6", 10_000, 600, 6},
}

// Price of 100 coins per currency: web (Paystack, cheaper) and app (Apple / Google). Larger packs scale linearly and snap to price points.
var hundredCoinPriceByCurrency = map[string]monthlyPair{
	"NGN": {100_000, 120_000}, "GHS": {1_200, 1_500}, "KES": {13_000, 16_000}, "ZAR": {1_899, 2_299},
	"GBP": {99, 119}, "EUR": {99, 119}, "USD": {99, 119},
}

func CoinPackPrices(coins int64, channel string) map[string]int64 {
	prices := map[string]int64{}
	for currency, pair := range hundredCoinPriceByCurrency {
		base := pair.web
		if channel != "web" {
			base = pair.app
		}
		prices[currency] = RoundToPricePoint(base*coins/100, currency)
	}
	return prices
}

func DefaultStoreCoinProductId(tier string) string {
	return "com.zudomart.app.coins.tier" + tier
}

type CreatorSubscriptionBand struct {
	Band     string `json:"band"`
	WebMinor int64  `json:"webMinor"`
	AppMinor int64  `json:"appMinor"`
}

var creatorBandOrder = []string{"supporter", "fan", "superfan", "vip"}

var defaultCreatorBands = map[string][]monthlyPair{
	"NG": {{50_000, 60_000}, {100_000, 120_000}, {200_000, 240_000}, {500_000, 590_000}},
	"GH": {{600, 700}, {1_200, 1_500}, {2_500, 3_000}, {6_000, 7_000}},
	"KE": {{10_000, 12_000}, {20_000, 25_000}, {40_000, 50_000}, {100_000, 120_000}},
	"ZA": {{1_499, 1_899}, {2_999, 3_499}, {5_999, 6_999}, {14_999, 17_999}},
	"GB": {{199, 249}, {399, 499}, {799, 999}, {1_599, 1_999}},
	"EU": {{199, 249}, {449, 549}, {899, 1_099}, {1_799, 2_199}},
	"US": {{199, 249}, {499, 599}, {999, 1_199}, {1_999, 2_499}},
}

func DefaultCreatorSubscriptionBands(region string) []CreatorSubscriptionBand {
	pairs, found := defaultCreatorBands[region]
	if !found {
		pairs = defaultCreatorBands[FallbackRegion.Code]
	}
	bands := make([]CreatorSubscriptionBand, len(pairs))
	for index, pair := range pairs {
		bands[index] = CreatorSubscriptionBand{Band: creatorBandOrder[index], WebMinor: pair.web, AppMinor: pair.app}
	}
	return bands
}
