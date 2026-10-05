package regionpricing

import (
	"fmt"
	"strconv"
	"strings"
)

const (
	CreatorStoreProductPrefix = "zudomart.creatorsub."
	CreatorStoreSlots         = 5
	creatorYearlyMonths       = 10
)

var CreatorTierKeys = []string{"500", "1000", "1500", "2000", "3000", "4000", "5000"}

var creatorTierMonthlyWebMinor = map[string][]int64{
	"NGN": {50_000, 100_000, 150_000, 200_000, 300_000, 400_000, 500_000},
	"GHS": {600, 1_200, 1_800, 2_500, 3_600, 4_800, 6_000},
	"KES": {10_000, 20_000, 30_000, 40_000, 60_000, 80_000, 100_000},
	"ZAR": {1_499, 2_999, 4_499, 5_999, 8_999, 11_999, 14_999},
	"GBP": {199, 399, 599, 799, 1_199, 1_399, 1_599},
	"EUR": {199, 449, 699, 899, 1_349, 1_599, 1_799},
	"USD": {199, 499, 749, 999, 1_499, 1_799, 1_999},
}

type CreatorTierPrice struct {
	Tier        string `json:"tier"`
	AmountMinor int64  `json:"amountMinor"`
	Currency    string `json:"currency"`
	Interval    string `json:"interval"`
}

func CreatorTierWebPrice(tier, currency, interval string) (int64, bool) {
	prices, found := creatorTierMonthlyWebMinor[strings.ToUpper(currency)]
	if !found {
		return 0, false
	}
	for index, key := range CreatorTierKeys {
		if key != tier {
			continue
		}
		switch interval {
		case "month":
			return prices[index], true
		case "year":
			return RoundToPricePoint(prices[index]*creatorYearlyMonths, strings.ToUpper(currency)), true
		}
	}
	return 0, false
}

func CreatorTierLadder(currency, interval string) []CreatorTierPrice {
	ladder := make([]CreatorTierPrice, 0, len(CreatorTierKeys))
	for _, tier := range CreatorTierKeys {
		if amount, found := CreatorTierWebPrice(tier, currency, interval); found {
			ladder = append(ladder, CreatorTierPrice{Tier: tier, AmountMinor: amount, Currency: strings.ToUpper(currency), Interval: interval})
		}
	}
	return ladder
}

func FindCreatorTier(amountMinor int64, currency, interval string) (string, bool) {
	for _, price := range CreatorTierLadder(currency, interval) {
		if price.AmountMinor == amountMinor {
			return price.Tier, true
		}
	}
	return "", false
}

func GrossUpForStoreFee(webMinor, feeBps int64, currency string) int64 {
	if webMinor <= 0 || feeBps <= 0 || feeBps >= 10_000 {
		return webMinor
	}
	grossed := (webMinor*10_000 + (10_000 - feeBps) - 1) / (10_000 - feeBps)
	return RoundToPricePoint(grossed, strings.ToUpper(currency))
}

var creatorIntervalSuffix = map[string]string{"month": "monthly", "year": "yearly"}

func CreatorStoreProductId(tier, interval string, slot int) string {
	return fmt.Sprintf("%stier_%s.s%d.%s", CreatorStoreProductPrefix, tier, slot, creatorIntervalSuffix[interval])
}

type CreatorStoreProduct struct {
	Tier     string
	Interval string
	Slot     int
}

func ParseCreatorStoreProductId(productId string) (CreatorStoreProduct, bool) {
	rest, found := strings.CutPrefix(productId, CreatorStoreProductPrefix+"tier_")
	parts := strings.Split(rest, ".")
	if !found || len(parts) != 3 || !strings.HasPrefix(parts[1], "s") {
		return CreatorStoreProduct{}, false
	}
	slot, err := strconv.Atoi(parts[1][1:])
	if err != nil || slot < 1 || slot > CreatorStoreSlots {
		return CreatorStoreProduct{}, false
	}
	for interval, suffix := range creatorIntervalSuffix {
		if suffix == parts[2] {
			if _, known := CreatorTierWebPrice(parts[0], "NGN", interval); known {
				return CreatorStoreProduct{Tier: parts[0], Interval: interval, Slot: slot}, true
			}
		}
	}
	return CreatorStoreProduct{}, false
}
