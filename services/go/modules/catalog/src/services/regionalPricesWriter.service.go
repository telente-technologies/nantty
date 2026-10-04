package services

import (
	"zudomart/modules/catalog/src/databases/schema"
	"zudomart/modules/catalog/src/modules/sellerProducts/dtos"
)

func regionalPricesOf(request dtos.VariantRequest, baseCurrency string) []schema.RegionalPrice {
	prices := make([]schema.RegionalPrice, 0, len(request.RegionalPrices))
	for _, price := range request.RegionalPrices {
		if price.Currency == baseCurrency {
			continue
		}
		prices = append(prices, schema.RegionalPrice{Currency: price.Currency, PriceMinor: price.PriceMinor, CompareAtPriceMinor: price.CompareAtPriceMinor})
	}
	return prices
}
