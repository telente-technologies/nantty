package services

import (
	"zudomart/modules/catalog/src/databases/schema"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/platform/viewerregion"
)

func RegionalPriceIn(variant *ent.ProductVariant, currency string) (schema.RegionalPrice, bool) {
	for _, price := range variant.RegionalPrices {
		if price.Currency == currency {
			return price, true
		}
	}
	return schema.RegionalPrice{}, false
}

func MarketCurrencyForCountry(country string) (string, bool) {
	if country == "" {
		return "", false
	}
	return viewerregion.CurrencyForCountry(country)
}

// AllHaveRegionalPrice reports whether every variant carries a price in the currency: a seller's lines in one order must share one currency.
func AllHaveRegionalPrice(variants []*ent.ProductVariant, currency string) bool {
	if len(variants) == 0 {
		return false
	}
	for _, variant := range variants {
		if _, found := RegionalPriceIn(variant, currency); !found {
			return false
		}
	}
	return true
}
