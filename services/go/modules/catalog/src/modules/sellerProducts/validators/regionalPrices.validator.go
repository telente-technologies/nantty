package validators

import (
	"strconv"

	"zudomart/modules/catalog/src/modules/sellerProducts/dtos"
	"zudomart/modules/catalog/src/utils"
	"zudomart/platform/viewerregion"
)

const maxRegionalPriceMinor = 100_000_000_000

func validateRegionalPrices(path string, prices []dtos.RegionalPriceRequest, collected *utils.Issues) {
	if len(prices) > len(viewerregion.SupportedCurrencies()) {
		collected.Add(path+".regionalPrices", "has too many entries")
		return
	}
	seen := map[string]bool{}
	for index, price := range prices {
		entry := path + ".regionalPrices." + strconv.Itoa(index)
		switch {
		case !viewerregion.IsSupportedCurrency(price.Currency):
			collected.Add(entry+".currency", "must be one of NGN, GHS, KES, ZAR, GBP, EUR, USD")
		case seen[price.Currency]:
			collected.Add(entry+".currency", "is set twice")
		}
		seen[price.Currency] = true
		if price.PriceMinor < 1 || price.PriceMinor > maxRegionalPriceMinor {
			collected.Add(entry+".priceMinor", "must be more than zero")
		}
		if price.CompareAtPriceMinor != nil && *price.CompareAtPriceMinor <= price.PriceMinor {
			collected.Add(entry+".compareAtPriceMinor", "must be higher than the price")
		}
	}
}
